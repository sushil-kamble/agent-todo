import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ensureLiveRun,
  ensureRunForTask,
  getLiveRun,
  preserveRunForTask,
  resetRunManagerState,
  setAgentClassResolver,
  startRun,
} from '#domains/runs/run-manager.mjs'
import { db } from '#infra/db/index.mjs'
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
              provider: 'claude',
              reasoningFormat: 'summary',
              outputDeltas: ['Need to collect context before ', 'final answer'],
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
    const reasoningMessage = rows.find(row => row.role === 'agent' && row.kind === 'reasoning')
    const commandMessage = rows.find(row => row.kind === 'command')

    expect(agentMessages.some(row => row.meta?.phase === 'commentary')).toBe(true)
    expect(agentMessages.some(row => row.meta?.phase === 'final')).toBe(true)
    expect(reasoningMessage).toMatchObject({
      content: 'Need to collect context before final answer',
      meta: {
        itemId: 'reasoning-item',
        provider: 'claude',
        reasoningFormat: 'summary',
      },
    })

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

  it('returns null when ensureRunForTask receives an unsupported agent', async () => {
    const task = {
      ...taskFactory({ id: 't-unsupported' }),
      agent: 'not-real',
    }

    await expect(ensureRunForTask(task)).resolves.toBeNull()
  })

  it('dedupes concurrent ensureRunForTask calls for the same task', async () => {
    class SlowFakeAgentClient extends FakeAgentClient {
      async initialize() {
        await sleep(50)
        return super.initialize()
      }
    }

    setAgentClassResolver(() => SlowFakeAgentClient)
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'turnCompleted' }]],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-dedupe' }))
    const [first, second] = await Promise.all([ensureRunForTask(task), ensureRunForTask(task)])

    expect(first.id).toBe(second.id)
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM runs WHERE task_id = ?').get(task.id).count
    ).toBe(1)
  })

  it('reattaches an active persisted run when ensureLiveRun is asked to resume it', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'turnCompleted' }]],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-resume', column_id: 'in_progress' }))
    const persisted = harness.runs.createRun({
      id: 'r-persisted',
      task_id: task.id,
      agent: task.agent,
      thread_id: 'thread-existing',
      status: 'active',
      created_at: new Date().toISOString(),
    })

    expect(getLiveRun(persisted.id)).toBeUndefined()

    const resumed = await ensureLiveRun(persisted.id)

    expect(resumed).toMatchObject({
      id: persisted.id,
      thread_id: 'thread-existing',
      status: 'active',
    })
    expect(getLiveRun(persisted.id)).toBeTruthy()
    expect(getFakeAgentSendLog()).toEqual([])
  })

  it('detaches an idle run without changing its transcript state', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'turnCompleted' }]],
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-detach-idle' }))
    const run = startRun(task)

    await waitFor(() => harness.runs.getRun(run.id)?.status === 'idle')
    const beforeMessages = harness.messages.listMessages(run.id)

    await preserveRunForTask(task.id)

    expect(getLiveRun(run.id)).toBeUndefined()
    expect(harness.runs.getRun(run.id)?.status).toBe('idle')
    expect(harness.messages.listMessages(run.id)).toEqual(beforeMessages)
  })

  it('parks an active run as paused when the task leaves in_progress', async () => {
    configureFakeAgentHarness({
      defaultScript: createFakeRunScript({
        turns: [[{ type: 'thread' }, { type: 'delay', ms: 500 }]],
        emitExitOnStop: true,
      }),
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-park-active' }))
    const run = startRun(task)

    await preserveRunForTask(task.id)
    await waitFor(() => getLiveRun(run.id) == null)

    expect(harness.runs.getRun(run.id)?.status).toBe('paused')
  })

  it('replays the bootstrap request when a paused run never produced any agent output', async () => {
    configureFakeAgentHarness({
      scriptsByTaskId: {
        't-replay-bootstrap': [
          createFakeRunScript({
            turns: [
              [
                { type: 'thread', threadId: 'thread-replay-bootstrap' },
                { type: 'delay', ms: 500 },
              ],
            ],
            emitExitOnStop: true,
          }),
          createFakeRunScript({
            turns: [
              [
                { type: 'thread', threadId: 'thread-replay-bootstrap' },
                { type: 'turnStarted', turnId: 'turn-bootstrap-replayed' },
                { type: 'turnCompleted', status: 'completed' },
              ],
            ],
          }),
        ],
      },
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-replay-bootstrap' }))
    const run = startRun(task)

    await preserveRunForTask(task.id)
    await waitFor(() => getLiveRun(run.id) == null)
    expect(harness.runs.getRun(run.id)?.status).toBe('paused')

    await ensureRunForTask(task)
    await waitFor(() => harness.runs.getRun(run.id)?.status === 'idle')

    expect(getFakeAgentSendLog().map(log => log.text)).toEqual([
      expect.stringContaining(task.title),
      expect.stringContaining(task.title),
    ])
    expect(harness.messages.listMessages(run.id).filter(row => row.role === 'user')).toHaveLength(1)
    expect(harness.runs.getRun(run.id)?.thread_id).toBe('thread-replay-bootstrap')
  })

  it('replays the last user follow-up when a paused run never responded to it', async () => {
    configureFakeAgentHarness({
      scriptsByTaskId: {
        't-replay-follow-up': [
          createFakeRunScript({
            turns: [
              [{ type: 'thread', threadId: 'thread-replay-follow-up' }, { type: 'turnCompleted' }],
              [{ type: 'delay', ms: 500 }],
            ],
            emitExitOnStop: true,
          }),
          createFakeRunScript({
            turns: [
              [
                { type: 'thread', threadId: 'thread-replay-follow-up' },
                { type: 'turnStarted', turnId: 'turn-follow-up-replayed' },
                { type: 'turnCompleted', status: 'completed' },
              ],
            ],
          }),
        ],
      },
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-replay-follow-up' }))
    const run = startRun(task)
    const entry = getLiveRun(run.id)
    await entry.ready
    await entry.client.sendUserText('follow-up pending')
    await preserveRunForTask(task.id)
    await waitFor(() => getLiveRun(run.id) == null)

    await ensureRunForTask(task)
    await waitFor(() => harness.runs.getRun(run.id)?.status === 'idle')

    expect(getFakeAgentSendLog().map(log => log.text)).toEqual([
      expect.stringContaining(task.title),
      'follow-up pending',
    ])
  })

  it('uses a continuation prompt when a paused run already started responding to the last user request', async () => {
    configureFakeAgentHarness({
      scriptsByTaskId: {
        't-continue-paused': [
          createFakeRunScript({
            turns: [
              [{ type: 'thread', threadId: 'thread-continue-paused' }, { type: 'turnCompleted' }],
              [
                { type: 'turnStarted', turnId: 'turn-partial' },
                {
                  type: 'agentMessage',
                  phase: 'commentary',
                  text: 'Started working on the follow-up',
                },
                { type: 'delay', ms: 500 },
              ],
            ],
            emitExitOnStop: true,
          }),
          createFakeRunScript({
            turns: [
              [
                { type: 'thread', threadId: 'thread-continue-paused' },
                { type: 'turnStarted', turnId: 'turn-follow-up-resumed' },
                { type: 'turnCompleted', status: 'completed' },
              ],
            ],
          }),
        ],
      },
    })

    const task = harness.tasks.createTask(taskFactory({ id: 't-continue-paused' }))
    const run = startRun(task)
    const entry = getLiveRun(run.id)
    await entry.ready
    await entry.client.sendUserText('finish the follow-up')
    await waitFor(() =>
      harness.messages
        .listMessages(run.id)
        .some(row => row.role === 'agent' && row.content === 'Started working on the follow-up')
    )

    await preserveRunForTask(task.id)
    await waitFor(() => getLiveRun(run.id) == null)

    await ensureRunForTask(task)
    await waitFor(() => harness.runs.getRun(run.id)?.status === 'idle')

    expect(getFakeAgentSendLog().map(log => log.text)).toEqual([
      expect.stringContaining(task.title),
      'finish the follow-up',
      expect.stringContaining('Continue the previous unfinished request from this thread.'),
    ])
    expect(harness.runs.getRun(run.id)?.thread_id).toBe('thread-continue-paused')
  })
})
