import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetFactoryCounters, runFactory, taskFactory } from '../helpers/factories.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

describe('tasks db', () => {
  let harness

  beforeAll(() => {
    harness = bootstrapTestDatabase('tasks-db')
  })

  afterAll(() => {
    harness.cleanup()
  })

  beforeEach(() => {
    harness.reset()
    resetFactoryCounters()
  })

  it('creates tasks at the next position within a column', () => {
    const first = harness.tasks.createTask(taskFactory({ id: 't-a', column_id: 'todo' }))
    const second = harness.tasks.createTask(taskFactory({ id: 't-b', column_id: 'todo' }))
    const done = harness.tasks.createTask(taskFactory({ id: 't-c', column_id: 'done' }))

    expect(first.position).toBe(0)
    expect(second.position).toBe(1)
    expect(done.position).toBe(0)
  })

  it('updates title/project/agent/tag/column/position correctly', () => {
    harness.tasks.createTask(taskFactory({ id: 't-a', column_id: 'todo' }))

    const updated = harness.tasks.updateTaskFields('t-a', {
      title: 'Updated title',
      project: '/tmp/updated',
      agent: 'claude',
      tag: 'updated-tag',
      column_id: 'in_progress',
      position: 4,
    })

    expect(updated).toMatchObject({
      id: 't-a',
      title: 'Updated title',
      project: '/tmp/updated',
      agent: 'claude',
      tag: 'updated-tag',
      column_id: 'in_progress',
      position: 4,
    })
  })

  it('deletes tasks cleanly', () => {
    harness.tasks.createTask(taskFactory({ id: 't-a' }))
    harness.tasks.createTask(taskFactory({ id: 't-b' }))

    harness.tasks.deleteTask('t-a')

    expect(harness.tasks.getTask('t-a')).toBeUndefined()
    expect(harness.tasks.getTask('t-b')).toMatchObject({ id: 't-b' })
  })

  it('listTasks returns run_status for active runs only', () => {
    const tActive = harness.tasks.createTask(taskFactory({ id: 't-active' }))
    const tFinished = harness.tasks.createTask(taskFactory({ id: 't-finished' }))
    const tInterrupted = harness.tasks.createTask(taskFactory({ id: 't-interrupted' }))

    harness.runs.createRun(runFactory(tActive.id, { id: 'r-active', status: 'running' }))
    harness.runs.createRun(runFactory(tFinished.id, { id: 'r-finished', status: 'completed' }))
    harness.runs.createRun(
      runFactory(tInterrupted.id, { id: 'r-interrupted', status: 'interrupted' })
    )

    const rows = harness.tasks.listTasks()
    const byId = Object.fromEntries(rows.map(row => [row.id, row]))

    expect(byId['t-active'].run_status).toBe('running')
    expect(byId['t-finished'].run_status).toBeNull()
    expect(byId['t-interrupted'].run_status).toBeNull()
  })

  it('listTaskStatuses returns only requested ids with null for no active run', () => {
    const a = harness.tasks.createTask(taskFactory({ id: 't-a' }))
    const b = harness.tasks.createTask(taskFactory({ id: 't-b' }))
    const c = harness.tasks.createTask(taskFactory({ id: 't-c' }))

    harness.runs.createRun(runFactory(a.id, { id: 'r-a', status: 'active' }))
    harness.runs.createRun(runFactory(b.id, { id: 'r-b', status: 'failed' }))
    harness.runs.createRun(runFactory(c.id, { id: 'r-c', status: 'interrupted' }))

    const rows = harness.tasks.listTaskStatuses([a.id, b.id, c.id])
    const byId = Object.fromEntries(rows.map(row => [row.id, row.run_status]))

    expect(Object.keys(byId).sort()).toEqual(['t-a', 't-b', 't-c'])
    expect(byId[a.id]).toBe('active')
    expect(byId[b.id]).toBeNull()
    expect(byId[c.id]).toBeNull()
  })
})
