import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetFactoryCounters, runFactory, taskFactory } from '../helpers/factories.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

describe('runs db', () => {
  let harness

  beforeAll(() => {
    harness = bootstrapTestDatabase('runs-db')
  })

  afterAll(() => {
    harness.cleanup()
  })

  beforeEach(() => {
    harness.reset()
    resetFactoryCounters()
  })

  it('createRun persists thread and status fields', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-run' }))

    const run = harness.runs.createRun(
      runFactory(task.id, {
        id: 'r-1',
        thread_id: 'thread-xyz',
        status: 'starting',
      })
    )

    expect(run).toMatchObject({
      id: 'r-1',
      task_id: task.id,
      thread_id: 'thread-xyz',
      status: 'starting',
    })
  })

  it('getActiveRunForTask ignores completed and failed runs', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-run' }))

    harness.runs.createRun(runFactory(task.id, { id: 'r-completed', status: 'completed' }))
    harness.runs.createRun(runFactory(task.id, { id: 'r-failed', status: 'failed' }))
    harness.runs.createRun(runFactory(task.id, { id: 'r-running', status: 'running' }))

    const active = harness.runs.getActiveRunForTask(task.id)
    expect(active?.id).toBe('r-running')
  })

  it('getLatestRunForTask returns latest regardless of status', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-run' }))

    harness.runs.createRun(
      runFactory(task.id, {
        id: 'r-old',
        status: 'active',
        created_at: '2026-01-01T00:00:00.000Z',
      })
    )
    harness.runs.createRun(
      runFactory(task.id, {
        id: 'r-new',
        status: 'failed',
        created_at: '2026-01-01T00:00:01.000Z',
      })
    )

    const latest = harness.runs.getLatestRunForTask(task.id)
    expect(latest?.id).toBe('r-new')
    expect(latest?.status).toBe('failed')
  })

  it('updateRun changes persisted run state', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-run' }))

    harness.runs.createRun(
      runFactory(task.id, {
        id: 'r-1',
        thread_id: null,
        status: 'starting',
      })
    )

    harness.runs.updateRun('r-1', {
      thread_id: 'thread-updated',
      status: 'active',
    })

    const updated = harness.runs.getRun('r-1')
    expect(updated).toMatchObject({
      id: 'r-1',
      thread_id: 'thread-updated',
      status: 'active',
    })
  })
})
