import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = resolve(__dirname, '../data/agent-todo.db')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  project TEXT NOT NULL,
  agent TEXT NOT NULL,
  tag TEXT,
  column_id TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent TEXT NOT NULL,
  thread_id TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  role TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  meta TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id);
`)

export function listTasks() {
  return db.prepare('SELECT * FROM tasks ORDER BY column_id, position ASC').all()
}
export function getTask(id) {
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id)
}
export function createTask(t) {
  const max = db
    .prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE column_id = ?')
    .get(t.column_id).m
  db.prepare(
    `INSERT INTO tasks (id, title, project, agent, tag, column_id, position, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(t.id, t.title, t.project, t.agent, t.tag ?? null, t.column_id, max + 1, t.created_at)
  return getTask(t.id)
}
export function updateTaskFields(id, updates) {
  const cur = getTask(id)
  if (!cur) return null
  const next = { ...cur, ...updates }
  db.prepare(
    `UPDATE tasks SET title=?, project=?, agent=?, tag=?, column_id=?, position=? WHERE id = ?`
  ).run(next.title, next.project, next.agent, next.tag ?? null, next.column_id, next.position, id)
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
    title: 'DO not edit the code, analyse the tell me the features of this project',
    project: '/Users/sushil/Projects/one-percent/1cc',
    agent: 'codex',
    tag: 'analysis',
    column_id: 'todo',
    created_at: now,
  })
}

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

export function appendMessage(runId, role, kind, content, meta = null) {
  const { n } = db
    .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM messages WHERE run_id = ?')
    .get(runId)
  db.prepare(
    `INSERT INTO messages (run_id, seq, role, kind, content, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(runId, n, role, kind, content, meta ? JSON.stringify(meta) : null, new Date().toISOString())
  return n
}
export function listMessages(runId) {
  return db
    .prepare('SELECT * FROM messages WHERE run_id = ? ORDER BY seq ASC')
    .all(runId)
    .map(m => ({ ...m, meta: m.meta ? JSON.parse(m.meta) : null }))
}
