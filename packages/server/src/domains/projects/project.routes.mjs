/**
 * Project API routes.
 *
 * GET    /api/projects       — list all projects
 * POST   /api/projects       — create a project
 * DELETE /api/projects/:id   — delete a project
 */
import { normalizeProjectPath } from '#infra/filesystem/project-path.mjs'
import { json, readBody } from '#infra/http/http.mjs'
import { createProject, deleteProject, listProjects } from './project.repository.mjs'

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
