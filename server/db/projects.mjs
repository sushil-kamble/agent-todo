/**
 * Project persistence — CRUD operations for the `projects` table.
 */
import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { db } from './index.mjs'

export function listProjects() {
  return db.prepare('SELECT * FROM projects ORDER BY name ASC').all()
}

export function getProjectByPath(path) {
  return db.prepare('SELECT * FROM projects WHERE path = ?').get(path) ?? null
}

export function createProject(path) {
  const existing = getProjectByPath(path)
  if (existing) return existing
  const id = `p-${randomUUID().slice(0, 8)}`
  const name = basename(path) || path
  const created_at = new Date().toISOString().slice(0, 10)
  db.prepare('INSERT INTO projects (id, path, name, created_at) VALUES (?, ?, ?, ?)').run(
    id,
    path,
    name,
    created_at
  )
  return getProjectByPath(path)
}

export function deleteProject(id) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
}

/** Seed the projects table from existing tasks' project paths. */
export function seedProjectsFromTasks() {
  const paths = db
    .prepare("SELECT DISTINCT project FROM tasks WHERE project != '' AND project != 'untitled'")
    .all()
    .map(r => r.project)
  for (const path of paths) {
    createProject(path)
  }
}
