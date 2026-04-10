/**
 * Project API routes.
 *
 * GET    /api/projects       — list all projects
 * POST   /api/projects       — create a project
 * DELETE /api/projects/:id   — delete a project
 */
import { createProject, deleteProject, listProjects } from '../db/projects.mjs'
import { json, readBody } from '../lib/http.mjs'
import { normalizeProjectPath } from '../lib/project-path.mjs'

export async function handleProjectRoutes(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/projects') {
    return json(res, 200, { projects: listProjects() })
  }

  if (req.method === 'POST' && pathname === '/api/projects') {
    const body = await readBody(req)
    const rawPath = String(body.path || '').trim()
    if (!rawPath) return json(res, 400, { error: 'path is required' })
    const normalized = await normalizeProjectPath(rawPath)
    const project = createProject(normalized)
    return json(res, 201, { project })
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/)
  if (req.method === 'DELETE' && projectMatch) {
    deleteProject(projectMatch[1])
    return json(res, 200, { ok: true })
  }

  return false
}
