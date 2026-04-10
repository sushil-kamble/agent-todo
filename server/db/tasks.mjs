/**
 * Task persistence — CRUD operations for the `tasks` table.
 */
import { db } from './index.mjs'

export function listTasks() {
  return db
    .prepare(`
    SELECT t.*,
           (SELECT status FROM runs
            WHERE task_id = t.id
              AND status NOT IN ('completed','failed','interrupted')
            ORDER BY created_at DESC LIMIT 1) AS run_status
    FROM tasks t
    ORDER BY t.column_id, t.position ASC
  `)
    .all()
}

export function listTaskStatuses(taskIds) {
  if (!Array.isArray(taskIds) || taskIds.length === 0) return []
  const placeholders = taskIds.map(() => '?').join(', ')
  return db
    .prepare(
      `SELECT t.id,
              (SELECT status FROM runs
               WHERE task_id = t.id
                 AND status NOT IN ('completed','failed','interrupted')
               ORDER BY created_at DESC LIMIT 1) AS run_status
       FROM tasks t
       WHERE t.id IN (${placeholders})`
    )
    .all(...taskIds)
}

export function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
}

export function createTask(t) {
  const max = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE column_id = ?')
    .get(t.column_id).m
  db.prepare(
    `INSERT INTO tasks (id, title, project, agent, tag, column_id, position, created_at, mode, model, effort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.id,
    t.title,
    t.project,
    t.agent,
    t.tag ?? null,
    t.column_id,
    max + 1,
    t.created_at,
    t.mode ?? 'code',
    t.model ?? null,
    t.effort ?? 'medium'
  )
  return getTask(t.id)
}

export function updateTaskFields(id, updates) {
  const cur = getTask(id)
  if (!cur) return null
  const next = { ...cur, ...updates }
  db.prepare(
    `UPDATE tasks SET title=?, project=?, agent=?, tag=?, column_id=?, position=?, mode=?, model=?, effort=? WHERE id = ?`
  ).run(
    next.title,
    next.project,
    next.agent,
    next.tag ?? null,
    next.column_id,
    next.position,
    next.mode ?? 'code',
    next.model ?? null,
    next.effort ?? 'medium',
    id
  )
  return getTask(id)
}

export function deleteTask(id) {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
}

export function seedIfEmpty() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM tasks').get()
  if (c > 0) return
  const now = new Date().toISOString().slice(0, 10)
  createTask({
    id: 't-1cc',
    title: 'Analyse the codebase and summarise the key features of this project',
    project: '/Users/sushil/Projects/one-percent/1cc',
    agent: 'codex',
    tag: 'analysis',
    column_id: 'todo',
    created_at: now,
  })
}
