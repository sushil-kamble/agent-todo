/**
 * Task API routes.
 *
 * GET    /api/tasks          — list all tasks
 * POST   /api/tasks          — create a task
 * PATCH  /api/tasks/:id      — update a task (+ auto-start codex run)
 * DELETE /api/tasks/:id      — delete a task
 * GET    /api/tasks/:id/run  — get the active run for a task
 */
import { randomUUID } from 'node:crypto'
import { json, readBody } from '../lib/http.mjs'
import { listTasks, getTask, createTask, updateTaskFields, deleteTask } from '../db/tasks.mjs'
import { getActiveRunForTask } from '../db/runs.mjs'
import { listMessages } from '../db/messages.mjs'
import { ensureRunForTask } from '../services/run-manager.mjs'

export async function handleTaskRoutes(req, res, pathname) {
  // GET /api/tasks
  if (req.method === 'GET' && pathname === '/api/tasks') {
    return json(res, 200, { tasks: listTasks() })
  }

  // POST /api/tasks
  if (req.method === 'POST' && pathname === '/api/tasks') {
    const body = await readBody(req)
    const id = `t-${randomUUID().slice(0, 5)}`
    const t = createTask({
      id,
      title: String(body.title || '').trim(),
      project: String(body.project || '').trim() || 'untitled',
      agent: body.agent === 'claude' ? 'claude' : 'codex',
      tag: body.tag ? String(body.tag) : null,
      column_id: ['todo', 'in_progress', 'done'].includes(body.column_id) ? body.column_id : 'todo',
      created_at: new Date().toISOString().slice(0, 10),
    })
    return json(res, 201, { task: t })
  }

  // PATCH /api/tasks/:id
  let m = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (req.method === 'PATCH' && m) {
    const id = m[1]
    const body = await readBody(req)
    const prev = getTask(id)
    if (!prev) return json(res, 404, { error: 'not found' })
    const t = updateTaskFields(id, {
      title: body.title ?? prev.title,
      project: body.project ?? prev.project,
      agent: body.agent ?? prev.agent,
      tag: body.tag === undefined ? prev.tag : body.tag,
      column_id: body.column_id ?? prev.column_id,
      position: body.position ?? prev.position,
    })

    // If this move brought the task into in_progress and it's a codex task,
    // kick off a run.
    let runId = null
    if (prev.column_id !== 'in_progress' && t.column_id === 'in_progress' && t.agent === 'codex') {
      try {
        const run = await ensureRunForTask(t)
        runId = run?.id ?? null
      } catch (e) {
        return json(res, 500, { error: `failed to start codex: ${e.message}` })
      }
    }
    return json(res, 200, { task: t, runId })
  }

  // DELETE /api/tasks/:id
  if (req.method === 'DELETE' && m) {
    deleteTask(m[1])
    return json(res, 200, { ok: true })
  }

  // GET /api/tasks/:id/run
  m = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/)
  if (req.method === 'GET' && m) {
    const run = getActiveRunForTask(m[1])
    if (!run) return json(res, 200, { run: null, messages: [] })
    return json(res, 200, { run, messages: listMessages(run.id) })
  }

  return false // not handled
}
