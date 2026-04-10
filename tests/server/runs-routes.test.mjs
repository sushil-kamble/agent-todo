import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getLiveRun,
  resetRunManagerState,
  setAgentClassResolver,
  startRun,
} from '../../server/services/run-manager.mjs'
import { taskFactory } from '../helpers/factories.mjs'
import {
  configureFakeAgentHarness,
  createFakeRunScript,
  FakeAgentClient,
  getFakeAgentSendLog,
} from '../helpers/fake-run-script.mjs'
import { startTestServer } from '../helpers/start-test-server.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function readSseUntil(
  response,
  { predicate = () => false, maxEvents = 20, timeoutMs = 1500 } = {}
) {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('SSE response did not contain a readable body')

  const decoder = new TextDecoder()
  const events = []
  let buffer = ''
  const started = Date.now()

  try {
    while (events.length < maxEvents && Date.now() - started < timeoutMs) {
      const readResult = await Promise.race([
        reader.read(),
        sleep(20).then(() => ({ timeout: true })),
      ])
      if (readResult?.timeout) continue
      if (readResult.done) break

      buffer += decoder.decode(readResult.value, { stream: true })
      let separator = buffer.indexOf('\n\n')
      while (separator !== -1) {
        const frame = buffer.slice(0, separator)
        buffer = buffer.slice(separator + 2)

        const dataLine = frame.split('\n').find(line => line.startsWith('data: '))
        if (dataLine) {
          const event = JSON.parse(dataLine.slice(6))
          events.push(event)
          if (predicate(events, event)) {
            return events
          }
        }

        separator = buffer.indexOf('\n\n')
      }
    }
  } finally {
    await reader.cancel()
  }

  return events
}

describe('run routes integration', () => {
  let harness
  let server

  beforeAll(() => {
    harness = bootstrapTestDatabase('run-routes')
  })

  beforeEach(async () => {
    harness.reset()
    setAgentClassResolver(() => FakeAgentClient)
    server = await startTestServer()
  })

  afterEach(async () => {
    resetRunManagerState()
    await server.close()
  })

  afterAll(() => {
    harness.cleanup()
  })

  it('POST /api/runs/:id/messages rejects empty text', async () => {
    const { status, body } = await server.json('/api/runs/r-missing/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })

    expect(status).toBe(400)
    expect(body.error).toBe('text required')
  })

  it('POST /api/runs/:id/messages rejects non-active runs', async () => {
    const { status, body } = await server.json('/api/runs/r-missing/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'hello' }),
    })

    expect(status).toBe(404)
    expect(body.error).toBe('run not active')
  })

  it('persists follow-up user message before forwarding to agent', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'turnCompleted' }], []],
        sendErrors: [undefined, 'follow-up dispatch failed'],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-follow' }))
    const run = startRun(task)

    const result = await server.json(`/api/runs/${run.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'follow-up question' }),
    })

    expect(result.status).toBe(500)
    expect(result.body.error).toBe('follow-up dispatch failed')

    const persisted = harness.messages.listMessages(run.id).map(row => `${row.role}:${row.content}`)

    expect(persisted).toContain('user:follow-up question')
  })

  it('waits for entry.ready before dispatching follow-up', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [
          [{ type: 'delay', ms: 100 }, { type: 'turnCompleted' }],
          [{ type: 'turnCompleted' }],
        ],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-ready-wait' }))
    const run = startRun(task)
    const entry = getLiveRun(run.id)

    const started = Date.now()
    const result = await server.json(`/api/runs/${run.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'wait-for-ready' }),
    })
    const elapsed = Date.now() - started

    expect(result.status).toBe(200)
    expect(entry.ready).toBeInstanceOf(Promise)
    expect(elapsed).toBeGreaterThanOrEqual(70)

    const sends = getFakeAgentSendLog()
    expect(sends.map(entryItem => entryItem.text)).toEqual(
      expect.arrayContaining(['wait-for-ready'])
    )
  })

  it('GET /api/runs/:id/events replays persisted history then streams live events', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [
          [{ type: 'thread' }, { type: 'turnCompleted' }],
          [
            { type: 'turnStarted' },
            {
              type: 'agentMessage',
              phase: 'final',
              text: 'streamed follow-up response',
            },
            { type: 'turnCompleted' },
          ],
        ],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-events-live' }))
    const run = startRun(task)
    const entry = getLiveRun(run.id)
    await entry.ready

    const eventsResponse = await server.request(`/api/runs/${run.id}/events`)

    await server.request(`/api/runs/${run.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'follow-up now' }),
    })

    const events = await readSseUntil(eventsResponse, {
      timeoutMs: 1500,
      predicate: (_events, event) =>
        event.type === 'message' &&
        event.role === 'agent' &&
        event.content === 'streamed follow-up response',
    })

    expect(events[0]).toMatchObject({
      type: 'message',
      role: 'user',
      content: task.title,
    })

    const userFollowUpIndex = events.findIndex(
      event =>
        event.type === 'message' && event.role === 'user' && event.content === 'follow-up now'
    )
    const agentReplyIndex = events.findIndex(
      event =>
        event.type === 'message' &&
        event.role === 'agent' &&
        event.content === 'streamed follow-up response'
    )

    expect(userFollowUpIndex).toBeGreaterThan(-1)
    expect(agentReplyIndex).toBeGreaterThan(userFollowUpIndex)
  })

  it('GET /api/runs/:id/events emits end immediately for non-live runs', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-events-ended', column_id: 'done' }))
    const run = harness.runs.createRun({
      id: 'r-events-ended',
      task_id: task.id,
      agent: task.agent,
      thread_id: 'thread-ended',
      status: 'completed',
      created_at: new Date().toISOString(),
    })
    harness.messages.appendMessage(run.id, 'user', 'text', 'persisted message')

    const eventsResponse = await server.request(`/api/runs/${run.id}/events`)
    const events = await readSseUntil(eventsResponse, {
      timeoutMs: 800,
      predicate: (_events, event) => event.type === 'end',
    })

    expect(events[0]).toMatchObject({
      type: 'message',
      content: 'persisted message',
    })
    expect(events.at(-1)).toMatchObject({ type: 'end' })
  })
})
