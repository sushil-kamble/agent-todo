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
  created_at TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'code',
  model TEXT,
  effort TEXT NOT NULL DEFAULT 'medium'
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

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_run ON messages(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_runs_task ON runs(task_id);
`

function resolveDbPath(pathOverride) {
  const fromEnv = process.env.AGENT_TODO_DB_PATH?.trim()
  const chosen = pathOverride || fromEnv || DEFAULT_DB_PATH
  return resolve(chosen)
}

const MIGRATIONS = [
  // Add mode, model, effort columns to tasks (introduced after initial schema).
  `ALTER TABLE tasks ADD COLUMN mode TEXT NOT NULL DEFAULT 'code'`,
  `ALTER TABLE tasks ADD COLUMN model TEXT`,
  `ALTER TABLE tasks ADD COLUMN effort TEXT NOT NULL DEFAULT 'medium'`,
]

function openDatabase(path) {
  mkdirSync(dirname(path), { recursive: true })
  const instance = new DatabaseSync(path)

  // Migrate old projects table (had path/created_at/last_used_at, no id/name).
  try {
    const cols = instance
      .prepare('PRAGMA table_info(projects)')
      .all()
      .map(c => c.name)
    if (cols.length > 0 && !cols.includes('id')) {
      instance.exec('DROP TABLE projects')
    }
  } catch {
    // table doesn't exist yet — fine
  }

  instance.exec(DB_SCHEMA)
  // Run safe migrations — skip if column already exists.
  for (const sql of MIGRATIONS) {
    try {
      instance.exec(sql)
    } catch (e) {
      if (!String(e?.message).includes('duplicate column')) throw e
    }
  }
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
    DELETE FROM projects;
  `)
}

export function getDatabasePath() {
  return dbPath
}

export function closeDatabase() {
  closeDatabaseSilently(db)
}
