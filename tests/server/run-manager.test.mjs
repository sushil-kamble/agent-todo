import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
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
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(check, timeoutMs = 1500) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (check()) return
    await sleep(10)
  }
  throw new Error('Timed out waiting for condition')
}

describe('run manager with fake agent', () => {
  let harness

  beforeAll(() => {
    harness = bootstrapTestDatabase('run-manager')
  })

  afterAll(() => {
    resetRunManagerState()
    harness.cleanup()
  })

  beforeEach(() => {
    harness.reset()
    setAgentClassResolver(() => FakeAgentClient)
  })

  it('startRun creates a run and initial user message', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({ turns: [[]] }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-run' }))
    const run = startRun(task)

    const row = harness.runs.getRun(run.id)
    const messages = harness.messages.listMessages(run.id)

    expect(row).toMatchObject({
      id: run.id,
      task_id: task.id,
      status: 'starting',
    })
    expect(messages[0]).toMatchObject({
      seq: 1,
      role: 'user',
      kind: 'text',
      content: task.title,
    })
  })

  it('bootstrap prompt includes working directory and task title', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({ turns: [[]] }),
    })

    const task = harness.tasks.createTask(
      taskFactory({
        id: 't-prompt',
        title: 'Investigate regression in transcript replay',
        project: '/tmp/workspace-a',
      })
    )

    startRun(task)

    await waitFor(() => getFakeAgentSendLog().length > 0)
    const firstSend = getFakeAgentSendLog()[0]

    expect(firstSend.text).toContain(`Working directory: ${task.project}`)
    expect(firstSend.text).toContain(task.title)
  })

  it('updates run status on thread, turn start, and turn completion', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [
          [
            { type: 'thread', threadId: 'thread-123' },
            { type: 'delay', ms: 40 },
            { type: 'turnStarted', turnId: 'turn-1' },
            { type: 'delay', ms: 40 },
            { type: 'turnCompleted', status: 'completed' },
          ],
        ],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-status' }))
    const run = startRun(task)

    await waitFor(() => harness.runs.getRun(run.id)?.status === 'running')
    await waitFor(() => harness.runs.getRun(run.id)?.status === 'active')
    await waitFor(() => harness.runs.getRun(run.id)?.status === 'idle')

    const row = harness.runs.getRun(run.id)
    expect(row?.thread_id).toBe('thread-123')
  })

  it('marks run completed on exit code 0 and failed on non-zero', async () => {
    configureFakeAgentHarness({
      scripts: [
        createFakeRunScript({ turns: [[{ type: 'exit', code: 0 }]] }),
        createFakeRunScript({ turns: [[{ type: 'exit', code: 3 }]] }),
      ],
    })

    const taskA = harness.tasks.createTask(taskFactory({ id: 't-exit-a' }))
    const runA = startRun(taskA)
    await waitFor(() => harness.runs.getRun(runA.id)?.status === 'completed')
    expect(getLiveRun(runA.id)).toBeUndefined()

    const taskB = harness.tasks.createTask(taskFactory({ id: 't-exit-b' }))
    const runB = startRun(taskB)
    await waitFor(() => harness.runs.getRun(runB.id)?.status === 'failed')
    expect(getLiveRun(runB.id)).toBeUndefined()
  })

  it('persists commentary/final messages, reasoning, and command metadata', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [
          [
            { type: 'thread' },
            {
              type: 'agentMessage',
              itemId: 'commentary-item',
              phase: 'commentary',
              text: 'Thinking out loud',
            },
            {
              type: 'reasoning',
              itemId: 'reasoning-item',
              text: 'Need to collect context before final answer',
            },
            {
              type: 'command',
              itemId: 'command-item',
              command: 'pnpm lint',
              cwd: '/tmp/test-cwd',
              status: 'completed',
              exitCode: 0,
              outputDeltas: ['ok'],
            },
            {
              type: 'agentMessage',
              itemId: 'final-item',
              phase: 'final',
              text: 'Final response',
            },
            { type: 'turnCompleted' },
          ],
        ],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-meta' }))
    const run = startRun(task)

    const entry = getLiveRun(run.id)
    await entry.ready

    const rows = harness.messages.listMessages(run.id)
    const agentMessages = rows.filter(row => row.role === 'agent' && row.kind === 'text')
    const commandMessage = rows.find(row => row.kind === 'command')

    expect(agentMessages.some(row => row.meta?.phase === 'commentary')).toBe(true)
    expect(agentMessages.some(row => row.meta?.phase === 'final')).toBe(true)
    expect(agentMessages.some(row => row.meta?.source === 'reasoning')).toBe(true)

    expect(commandMessage?.content).toBe('$ pnpm lint (exit 0)')
    expect(commandMessage?.meta).toMatchObject({
      cwd: '/tmp/test-cwd',
      status: 'completed',
      exitCode: 0,
    })
  })

  it('handles bootstrap failure by persisting system error and removing live run', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        sendErrors: ['bootstrap failed'],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-fail' }))
    const run = startRun(task)

    await waitFor(() => harness.runs.getRun(run.id)?.status === 'failed')

    const rows = harness.messages.listMessages(run.id)
    expect(rows.some(row => row.role === 'system' && row.kind === 'error')).toBe(true)
    expect(getLiveRun(run.id)).toBeUndefined()
  })
})
