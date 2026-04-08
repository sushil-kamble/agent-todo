/**
 * Run persistence — CRUD operations for the `runs` table.
 */
import { db } from './index.mjs'

export function createRun(r) {
  db.prepare(
    'INSERT INTO runs (id, task_id, agent, thread_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(r.id, r.task_id, r.agent, r.thread_id ?? null, r.status, r.created_at)
  return getRun(r.id)
}

export function getRun(id) {
  return db.prepare('SELECT * FROM runs WHERE id = ?').get(id)
}

export function getActiveRunForTask(taskId) {
  return db
    .prepare(
      `SELECT * FROM runs WHERE task_id = ? AND status NOT IN ('completed','failed')
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(taskId)
}

export function updateRun(id, updates) {
  const cur = getRun(id)
  if (!cur) return
  const next = { ...cur, ...updates }
  db.prepare('UPDATE runs SET thread_id=?, status=? WHERE id=?').run(
    next.thread_id ?? null,
    next.status,
    id
  )
}
