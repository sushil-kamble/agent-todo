import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  getLiveRun,
  resetRunManagerState,
  setAgentClassResolver,
} from '../../server/services/run-manager.mjs'
import { runFactory, taskFactory } from '../helpers/factories.mjs'
import {
  configureFakeAgentHarness,
  createFakeRunScript,
  FakeAgentClient,
} from '../helpers/fake-run-script.mjs'
import { startTestServer } from '../helpers/start-test-server.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

describe('task routes integration', () => {
  let harness
  let server

  beforeAll(() => {
    harness = bootstrapTestDatabase('task-routes')
  })

  beforeEach(async () => {
    harness.reset()
    setAgentClassResolver(() => FakeAgentClient)
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'turnCompleted' }]],
      }),
    })
    server = await startTestServer()
  })

  afterEach(async () => {
    resetRunManagerState()
    await server.close()
  })

  afterAll(() => {
    harness.cleanup()
  })

  it('GET /api/tasks returns tasks in board shape', async () => {
    harness.tasks.createTask(taskFactory({ id: 't-a', column_id: 'todo' }))
    harness.tasks.createTask(taskFactory({ id: 't-b', column_id: 'done' }))

    const { status, body } = await server.json('/api/tasks')

    expect(status).toBe(200)
    expect(Array.isArray(body.tasks)).toBe(true)
    expect(body.tasks.map(task => task.id).sort()).toEqual(['t-a', 't-b'])
  })

  it('POST /api/tasks trims fields, normalizes project path, and defaults invalid agent/column', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: '   New task title   ',
        project: '   server   ',
        agent: 'not-real',
        column_id: 'bad-column',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.title).toBe('New task title')
    expect(body.task.agent).toBe('codex')
    expect(body.task.column_id).toBe('todo')
    expect(body.task.project).toBe(resolve(process.cwd(), 'server'))
  })

  it('PATCH /api/tasks/:id updates fields', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-patch', project: '/tmp/original' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Updated',
        project: '/tmp/updated',
        agent: 'claude',
        tag: 'edited',
        column_id: 'done',
        position: 2,
      }),
    })

    expect(status).toBe(200)
    expect(body.task).toMatchObject({
      id: task.id,
      title: 'Updated',
      project: '/tmp/updated',
      agent: 'claude',
      tag: 'edited',
      column_id: 'done',
      position: 2,
    })
  })

  it('PATCH moving to in_progress starts a run and returns runId', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-run-start', column_id: 'todo' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column_id: 'in_progress' }),
    })

    expect(status).toBe(200)
    expect(body.runId).toBeTruthy()
    expect(getLiveRun(body.runId)).toBeTruthy()
  })

  it('PATCH invalid id returns 404', async () => {
    const { status } = await server.json('/api/tasks/missing-id', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'nope' }),
    })

    expect(status).toBe(404)
  })

  it('PATCH bootstrap failure returns 500 with agent-specific text', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({ sendErrors: ['bootstrap blew up'] }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-fail', agent: 'claude' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column_id: 'in_progress' }),
    })

    expect(status).toBe(500)
    expect(body.error).toContain('failed to start claude: bootstrap blew up')
  })

  it('DELETE /api/tasks/:id removes task', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-delete', column_id: 'todo' }))

    const del = await server.json(`/api/tasks/${task.id}`, {
      method: 'DELETE',
    })

    expect(del.status).toBe(200)

    const list = await server.json('/api/tasks')
    expect(list.body.tasks.some(entry => entry.id === task.id)).toBe(false)
  })

  it('GET /api/tasks/statuses returns requested map only', async () => {
    const t1 = harness.tasks.createTask(taskFactory({ id: 't-s1' }))
    const t2 = harness.tasks.createTask(taskFactory({ id: 't-s2' }))
    harness.runs.createRun(runFactory(t1.id, { id: 'r-s1', status: 'active' }))

    const { status, body } = await server.json(`/api/tasks/statuses?ids=${t1.id},${t2.id}`)

    expect(status).toBe(200)
    expect(body.statuses).toEqual({
      [t1.id]: 'active',
      [t2.id]: null,
    })
  })

  it('GET /api/tasks/:id/run returns latest persisted history', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-history', column_id: 'done' }))
    const run = harness.runs.createRun(
      runFactory(task.id, { id: 'r-history', status: 'completed' })
    )
    harness.messages.appendMessage(run.id, 'user', 'text', 'hello')
    harness.messages.appendMessage(run.id, 'agent', 'text', 'world', {
      phase: 'final',
    })

    const { status, body } = await server.json(`/api/tasks/${task.id}/run`)

    expect(status).toBe(200)
    expect(body.run.id).toBe(run.id)
    expect(body.messages.map(message => message.content)).toEqual(['hello', 'world'])
  })

  it('GET /api/tasks/:id/run auto-starts in-progress task when no active run exists', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-auto', column_id: 'in_progress' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}/run`)

    expect(status).toBe(200)
    expect(body.run).toBeTruthy()
    expect(body.messages.length).toBeGreaterThanOrEqual(1)
    expect(body.messages[0].role).toBe('user')
  })

  it('GET /api/tasks/:id/run returns run null/messages empty when no run exists', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-no-run', column_id: 'todo' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}/run`)

    expect(status).toBe(200)
    expect(body).toEqual({ run: null, messages: [] })
  })
})
