import { resolve } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_AGENT } from '#domains/agents/agent-config.mjs'
import { DEFAULT_TASK_MODE } from '#domains/agents/task-mode-config.mjs'
import {
  getLiveRun,
  resetRunManagerState,
  setAgentClassResolver,
} from '#domains/runs/run-manager.mjs'
import { runFactory, taskFactory } from '../helpers/factories.mjs'
import {
  configureFakeAgentHarness,
  createFakeRunScript,
  FakeAgentClient,
} from '../helpers/fake-run-script.mjs'
import { startTestServer } from '../helpers/start-test-server.mjs'
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
        mode: 'not-a-real-mode',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.title).toBe('New task title')
    expect(body.task.agent).toBe(DEFAULT_AGENT)
    expect(body.task.column_id).toBe('todo')
    expect(body.task.mode).toBe(DEFAULT_TASK_MODE)
    expect(body.task.project).toBe(resolve(process.cwd()))
  })

  it('POST /api/tasks accepts backlog as a persisted task column', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Backlog item',
        project: 'server',
        column_id: 'backlog',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.column_id).toBe('backlog')
  })

  it('POST /api/tasks drops models that do not belong to the selected agent', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Cross-agent model',
        project: 'server',
        agent: 'codex',
        model: 'claude-haiku-4-5',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.agent).toBe('codex')
    expect(body.task.model).toBeNull()
    expect(body.task.effort).toBe('medium')
    expect(body.task.fast_mode).toBe(0)
  })

  it('POST /api/tasks persists fast mode only for Codex models that support it', async () => {
    const supported = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Fast supported',
        project: 'server',
        agent: 'codex',
        model: 'gpt-5.4',
        fastMode: true,
      }),
    })

    const unsupported = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Fast unsupported',
        project: 'server',
        agent: 'codex',
        model: 'gpt-5.3-codex',
        fastMode: true,
      }),
    })

    expect(supported.status).toBe(201)
    expect(supported.body.task.fast_mode).toBe(1)
    expect(unsupported.status).toBe(201)
    expect(unsupported.body.task.fast_mode).toBe(0)
  })

  it('POST /api/tasks persists task type and constrains incompatible modes', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Review this change',
        project: 'server',
        taskType: 'code_review',
        mode: 'code',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.task_type).toBe('code_review')
    expect(body.task.mode).toBe('ask')
  })

  it('POST /api/tasks rejects project-required task types when no project is provided', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Plan this change',
        project: '',
        taskType: 'feature_plan',
        mode: 'ask',
      }),
    })

    expect(status).toBe(400)
    expect(body.error).toBe('project is required for this task type')
  })

  it('POST /api/tasks allows brainstorming without a project', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Explore some ideas',
        project: '',
        taskType: 'brainstorming',
        mode: 'ask',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.task_type).toBe('brainstorming')
    expect(body.task.project).toBe('untitled')
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
      column_id: 'done',
      position: 0,
    })
  })

  it('PATCH ignores invalid mode values and keeps the current one', async () => {
    const task = harness.tasks.createTask({
      ...taskFactory({ id: 't-mode' }),
      mode: 'ask',
    })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'not-a-real-mode' }),
    })

    expect(status).toBe(200)
    expect(body.task.mode).toBe('ask')
  })

  it('PATCH updates task type and keeps invalid task type patches from clearing it', async () => {
    const task = harness.tasks.createTask(
      taskFactory({ id: 't-task-type', task_type: 'feature_dev' })
    )

    const updated = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'write_tests',
      }),
    })

    expect(updated.status).toBe(200)
    expect(updated.body.task.task_type).toBe('write_tests')

    const invalid = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'not-real',
      }),
    })

    expect(invalid.status).toBe(200)
    expect(invalid.body.task.task_type).toBe('write_tests')
  })

  it('PATCH changing to an ask-only task type falls back to ask mode', async () => {
    const task = harness.tasks.createTask(
      taskFactory({ id: 't-task-type-mode', task_type: 'feature_dev' })
    )
    harness.tasks.updateTaskFields(task.id, { mode: 'code' })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'feature_plan',
      }),
    })

    expect(status).toBe(200)
    expect(body.task.task_type).toBe('feature_plan')
    expect(body.task.mode).toBe('ask')
  })

  it('PATCH rejects changing to a project-required task type when the task has no project', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-task-type-projectless' }))
    harness.tasks.updateTaskFields(task.id, { project: 'untitled' })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        taskType: 'write_tests',
      }),
    })

    expect(status).toBe(400)
    expect(body.error).toBe('project is required for this task type')
  })

  it('PATCH clears a stored model when switching to a different agent family', async () => {
    const task = harness.tasks.createTask({
      ...taskFactory({ id: 't-switch-agent' }),
      agent: 'claude',
      model: 'claude-haiku-4-5',
      effort: 'medium',
    })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        agent: 'codex',
      }),
    })

    expect(status).toBe(200)
    expect(body.task.agent).toBe('codex')
    expect(body.task.model).toBeNull()
    expect(body.task.effort).toBe('medium')
  })

  it('POST falls back to the model default effort when the requested effort is unsupported', async () => {
    const { status, body } = await server.json('/api/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Unsupported effort',
        project: 'server',
        agent: 'claude',
        model: 'claude-haiku-4-5',
        effort: 'max',
      }),
    })

    expect(status).toBe(201)
    expect(body.task.model).toBe('claude-haiku-4-5')
    expect(body.task.effort).toBe('medium')
  })

  it('PATCH switching codex models clears fast mode when the new model does not support it', async () => {
    const task = harness.tasks.createTask({
      ...taskFactory({ id: 't-fast-switch' }),
      agent: 'codex',
      model: 'gpt-5.4',
      effort: 'high',
      fast_mode: 1,
    })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-5.4-mini',
      }),
    })

    expect(status).toBe(200)
    expect(body.task.model).toBe('gpt-5.4-mini')
    expect(body.task.fast_mode).toBe(0)
    expect(body.task.effort).toBe('high')
  })

  it('PATCH preserves valid model and effort combinations within the same agent family', async () => {
    const task = harness.tasks.createTask({
      ...taskFactory({ id: 't-preserve-model' }),
      agent: 'codex',
      model: 'gpt-5.3-codex',
      effort: 'xhigh',
      fast_mode: 0,
    })

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        effort: 'xhigh',
      }),
    })

    expect(status).toBe(200)
    expect(body.task.model).toBe('gpt-5.3-codex')
    expect(body.task.effort).toBe('xhigh')
    expect(body.task.fast_mode).toBe(0)
  })

  it('PATCH moves backlog items into todo without starting a run', async () => {
    const task = harness.tasks.createTask(
      taskFactory({ id: 't-backlog-move', column_id: 'backlog' })
    )
    harness.tasks.createTask(taskFactory({ id: 't-todo-a', column_id: 'todo' }))
    harness.tasks.createTask(taskFactory({ id: 't-todo-b', column_id: 'todo' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column_id: 'todo', position: 0 }),
    })

    expect(status).toBe(200)
    expect(body.task.column_id).toBe('todo')
    expect(body.task.position).toBe(0)
    expect(body.runId).toBeNull()

    const list = await server.json('/api/tasks')
    const todoTasks = list.body.tasks.filter(entry => entry.column_id === 'todo')
    expect(todoTasks.map(entry => [entry.id, entry.position])).toEqual([
      ['t-backlog-move', 0],
      ['t-todo-a', 1],
      ['t-todo-b', 2],
    ])
  })

  it('PATCH position reorders tasks within the same column', async () => {
    harness.tasks.createTask(taskFactory({ id: 't-reorder-a', column_id: 'todo' }))
    harness.tasks.createTask(taskFactory({ id: 't-reorder-b', column_id: 'todo' }))
    harness.tasks.createTask(taskFactory({ id: 't-reorder-c', column_id: 'todo' }))

    const { status, body } = await server.json('/api/tasks/t-reorder-c', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ position: 0 }),
    })

    expect(status).toBe(200)
    expect(body.task.column_id).toBe('todo')
    expect(body.task.position).toBe(0)

    const list = await server.json('/api/tasks')
    const todoTasks = list.body.tasks.filter(entry => entry.column_id === 'todo')
    expect(todoTasks.map(entry => [entry.id, entry.position])).toEqual([
      ['t-reorder-c', 0],
      ['t-reorder-a', 1],
      ['t-reorder-b', 2],
    ])
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

  it('PATCH moving out of in_progress interrupts the active run immediately', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'delay', ms: 500 }, { type: 'turnCompleted' }]],
        emitExitOnStop: true,
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-stop-now', column_id: 'todo' }))
    const started = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column_id: 'in_progress' }),
    })

    expect(started.status).toBe(200)
    expect(started.body.runId).toBeTruthy()
    expect(getLiveRun(started.body.runId)).toBeTruthy()

    const stopped = await server.json(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ column_id: 'todo' }),
    })

    expect(stopped.status).toBe(200)
    expect(stopped.body.task.column_id).toBe('todo')
    await waitFor(() => getLiveRun(started.body.runId) == null)
    expect(harness.runs.getRun(started.body.runId)?.status).toBe('interrupted')
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

  it('DELETE /api/tasks/:id removes backlog items too', async () => {
    const task = harness.tasks.createTask(
      taskFactory({ id: 't-delete-backlog', column_id: 'backlog' })
    )

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

  it('GET /api/tasks/:id/run?autostart=false returns static history only', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-static', column_id: 'in_progress' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}/run?autostart=false`)

    expect(status).toBe(200)
    expect(body).toEqual({ run: null, messages: [] })
  })

  it('GET /api/tasks/:id/run does not auto-start in-progress task when no active run exists', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-auto', column_id: 'in_progress' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}/run`)

    expect(status).toBe(200)
    expect(body).toEqual({ run: null, messages: [] })
  })

  it('GET /api/tasks/:id/run returns run null/messages empty when no run exists', async () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-no-run', column_id: 'todo' }))

    const { status, body } = await server.json(`/api/tasks/${task.id}/run`)

    expect(status).toBe(200)
    expect(body).toEqual({ run: null, messages: [] })
  })
})
