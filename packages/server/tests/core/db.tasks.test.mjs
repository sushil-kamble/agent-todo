import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, configureDatabase, db } from '#infra/db/index.mjs'
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

  it('updates title/project/agent/column/position correctly', () => {
    harness.tasks.createTask(taskFactory({ id: 't-a', column_id: 'todo' }))

    const updated = harness.tasks.updateTaskFields('t-a', {
      title: 'Updated title',
      project: '/tmp/updated',
      agent: 'claude',
      column_id: 'in_progress',
      position: 4,
    })

    expect(updated).toMatchObject({
      id: 't-a',
      title: 'Updated title',
      project: '/tmp/updated',
      agent: 'claude',
      column_id: 'in_progress',
      position: 0,
    })
  })

  it('round-trips task_type through create and update operations', () => {
    const created = harness.tasks.createTask(
      taskFactory({ id: 't-typed', task_type: 'feature_dev' })
    )

    expect(created.task_type).toBe('feature_dev')

    const updated = harness.tasks.updateTaskFields(created.id, {
      task_type: 'write_tests',
    })

    expect(updated.task_type).toBe('write_tests')
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

  it('normalizes task positions and creates the current task ordering index', () => {
    const root = mkdtempSync(join(tmpdir(), 'agent-todo-db-normalize-'))
    const dbPath = join(root, 'normalize.db')
    const tempDb = new DatabaseSync(dbPath)

    tempDb.exec(`
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project TEXT NOT NULL,
        agent TEXT NOT NULL,
        column_id TEXT NOT NULL,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        mode TEXT NOT NULL DEFAULT 'code',
        model TEXT,
        effort TEXT NOT NULL DEFAULT 'medium',
        fast_mode INTEGER NOT NULL DEFAULT 0
      );

      INSERT INTO tasks (id, title, project, agent, column_id, position, created_at, mode, model, effort, fast_mode)
      VALUES
        ('t-done-a', 'Done A', '/tmp/a', 'codex', 'done', 1, '2026-04-12', 'code', NULL, 'medium', 0),
        ('t-done-b', 'Done B', '/tmp/b', 'codex', 'done', 1, '2026-04-13', 'code', NULL, 'medium', 0),
        ('t-done-c', 'Done C', '/tmp/c', 'codex', 'done', 4, '2026-04-14', 'code', NULL, 'medium', 0);
    `)
    tempDb.close()

    try {
      configureDatabase({ path: dbPath })

      const rows = db
        .prepare(
          `SELECT id, position
           FROM tasks
           WHERE column_id = 'done'
           ORDER BY position ASC, created_at ASC, id ASC`
        )
        .all()
      const columns = db.prepare('PRAGMA table_info(tasks)').all()
      const indexes = db.prepare('PRAGMA index_list(tasks)').all()

      expect(rows).toEqual([
        { id: 't-done-a', position: 0 },
        { id: 't-done-b', position: 1 },
        { id: 't-done-c', position: 2 },
      ])
      expect(columns.some(column => column.name === 'task_type')).toBe(true)
      expect(
        indexes.some(index => index.name === 'idx_tasks_column_position' && index.unique === 1)
      ).toBe(true)
    } finally {
      closeDatabase()
      rmSync(root, { recursive: true, force: true })
      configureDatabase({ path: harness.dbPath })
    }
  })
})
