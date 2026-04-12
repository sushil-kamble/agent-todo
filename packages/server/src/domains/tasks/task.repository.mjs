/**
 * Task persistence — CRUD operations for the `tasks` table.
 */
import { db } from '#infra/db/index.mjs'

export function listTasks() {
  return db
    .prepare(`
    SELECT t.*,
           (SELECT status FROM runs
            WHERE task_id = t.id
              AND status NOT IN ('completed','failed','interrupted')
            ORDER BY created_at DESC LIMIT 1) AS run_status
    FROM tasks t
    ORDER BY CASE t.column_id
      WHEN 'backlog' THEN 0
      WHEN 'todo' THEN 1
      WHEN 'in_progress' THEN 2
      WHEN 'done' THEN 3
      ELSE 99
    END,
    t.position ASC,
    t.created_at ASC,
    t.id ASC
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

function listTaskIdsForColumn(columnId, excludedTaskId = null) {
  return db
    .prepare(
      `SELECT id
       FROM tasks
       WHERE column_id = ?
         AND (? IS NULL OR id != ?)
       ORDER BY position ASC, created_at ASC, id ASC`
    )
    .all(columnId, excludedTaskId, excludedTaskId)
    .map(row => row.id)
}

function clampPosition(position, max) {
  const normalized = Number.isFinite(position) ? Math.trunc(position) : 0
  return Math.max(0, Math.min(normalized, max))
}

function reindexColumn(columnId, orderedIds) {
  const updatePosition = db.prepare('UPDATE tasks SET position = ? WHERE id = ? AND column_id = ?')
  for (const [index, taskId] of orderedIds.entries()) {
    updatePosition.run(index, taskId, columnId)
  }
}

function displaceColumnPositions(columnId, excludedTaskId, offset) {
  db.prepare(
    `UPDATE tasks
     SET position = position + ?
     WHERE column_id = ?
       AND (? IS NULL OR id != ?)`
  ).run(offset, columnId, excludedTaskId, excludedTaskId)
}

export function createTask(t) {
  const max = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE column_id = ?')
    .get(t.column_id).m
  db.prepare(
    `INSERT INTO tasks (id, title, project, agent, column_id, position, created_at, mode, model, effort, fast_mode, task_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    t.id,
    t.title,
    t.project,
    t.agent,
    t.column_id,
    max + 1,
    t.created_at,
    t.mode ?? 'code',
    t.model ?? null,
    t.effort ?? 'medium',
    t.fast_mode ? 1 : 0,
    t.task_type ?? null
  )
  return getTask(t.id)
}

export function updateTaskFields(id, updates) {
  const cur = getTask(id)
  if (!cur) return null
  const next = {
    ...cur,
    ...Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined)),
  }
  const columnChanged = next.column_id !== cur.column_id
  const positionChanged = typeof updates.position === 'number'

  if (!columnChanged && !positionChanged) {
    db.prepare(
      `UPDATE tasks SET title=?, project=?, agent=?, column_id=?, position=?, mode=?, model=?, effort=?, fast_mode=?, task_type=? WHERE id = ?`
    ).run(
      next.title,
      next.project,
      next.agent,
      next.column_id,
      next.position,
      next.mode ?? 'code',
      next.model ?? null,
      next.effort ?? 'medium',
      next.fast_mode ? 1 : 0,
      next.task_type ?? null,
      id
    )
    return getTask(id)
  }

  db.exec('BEGIN')
  try {
    const targetIds = listTaskIdsForColumn(next.column_id, id)
    const targetPosition = clampPosition(
      positionChanged ? updates.position : columnChanged ? 0 : cur.position,
      targetIds.length
    )
    targetIds.splice(targetPosition, 0, id)
    displaceColumnPositions(next.column_id, id, targetIds.length + 1)

    db.prepare(
      `UPDATE tasks SET title=?, project=?, agent=?, column_id=?, position=?, mode=?, model=?, effort=?, fast_mode=?, task_type=? WHERE id = ?`
    ).run(
      next.title,
      next.project,
      next.agent,
      next.column_id,
      targetPosition,
      next.mode ?? 'code',
      next.model ?? null,
      next.effort ?? 'medium',
      next.fast_mode ? 1 : 0,
      next.task_type ?? null,
      id
    )

    if (columnChanged) {
      reindexColumn(cur.column_id, listTaskIdsForColumn(cur.column_id))
    }
    reindexColumn(next.column_id, targetIds)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }

  return getTask(id)
}

export function deleteTask(id) {
  const task = getTask(id)
  if (!task) return

  db.exec('BEGIN')
  try {
    db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
    reindexColumn(task.column_id, listTaskIdsForColumn(task.column_id))
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
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
    column_id: 'todo',
    created_at: now,
  })
}
