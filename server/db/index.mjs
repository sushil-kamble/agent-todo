/**
 * Database connection and schema.
 * All other db/ modules import `db` from here.
 */

import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const DEFAULT_DB_PATH = join(homedir(), '.agent-todo', 'agent-todo.db')

const DB_SCHEMA = `
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
`

function resolveDbPath(pathOverride) {
  const fromEnv = process.env.AGENT_TODO_DB_PATH?.trim()
  const chosen = pathOverride || fromEnv || DEFAULT_DB_PATH
  return resolve(chosen)
}

function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true })
  const instance = new DatabaseSync(path)
  instance.exec(DB_SCHEMA)
  return instance
}

function closeDatabaseSilently(instance) {
  try {
    instance?.close?.()
  } catch {
    // ignore close errors during test reconfiguration
  }
}

export let dbPath = resolveDbPath()
export let db = openDatabase(dbPath)

export function configureDatabase({ path } = {}) {
  const nextPath = resolveDbPath(path)
  if (nextPath === dbPath) return db
  closeDatabaseSilently(db)
  dbPath = nextPath
  db = openDatabase(dbPath)
  return db
}

export function resetDatabase() {
  db.exec(`
    DELETE FROM messages;
    DELETE FROM runs;
    DELETE FROM tasks;
  `)
}

export function getDatabasePath() {
  return dbPath
}

export function closeDatabase() {
  closeDatabaseSilently(db)
}
