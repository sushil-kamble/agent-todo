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
import { listMessages } from '../db/messages.mjs'
import { getActiveRunForTask, getLatestRunForTask } from '../db/runs.mjs'
import {
  createTask,
  deleteTask,
  getTask,
  listTaskStatuses,
  listTasks,
  updateTaskFields,
} from '../db/tasks.mjs'
import { json, readBody } from '../lib/http.mjs'
import { normalizeProjectPath } from '../lib/project-path.mjs'
import { ensureRunForTask } from '../services/run-manager.mjs'

export async function handleTaskRoutes(req, res, pathname) {
  // GET /api/tasks
  if (req.method === 'GET' && pathname === '/api/tasks') {
    return json(res, 200, { tasks: listTasks() })
  }

  if (req.method === 'GET' && pathname === '/api/tasks/statuses') {
    const url = new URL(req.url, 'http://localhost')
    const ids = url.searchParams
      .get('ids')
      ?.split(',')
      .map(id => id.trim())
      .filter(Boolean)
    const statuses = Object.fromEntries(
      listTaskStatuses(ids ?? []).map(row => [row.id, row.run_status ?? null])
    )
    return json(res, 200, { statuses })
  }

  if (req.method === 'POST' && pathname === '/api/paths/resolve-directory') {
    const body = await readBody(req)
    return json(res, 200, { path: await normalizeProjectPath(body.path) })
  }

  // POST /api/tasks
  if (req.method === 'POST' && pathname === '/api/tasks') {
    const body = await readBody(req)
    const id = `t-${randomUUID().slice(0, 5)}`
    const t = createTask({
      id,
      title: String(body.title || '').trim(),
      project: (await normalizeProjectPath(String(body.project || '').trim())) || 'untitled',
      agent: body.agent === 'claude' ? 'claude' : 'codex',
      tag: body.tag ? String(body.tag) : null,
      column_id: ['todo', 'in_progress', 'done'].includes(body.column_id) ? body.column_id : 'todo',
      created_at: new Date().toISOString().slice(0, 10),
    })
    return json(res, 201, { task: t })
  }

  // PATCH /api/tasks/:id
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (req.method === 'PATCH' && taskMatch) {
    const id = taskMatch[1]
    const body = await readBody(req)
    const prev = getTask(id)
    if (!prev) return json(res, 404, { error: 'not found' })
    const normalizedProject =
      body.project === undefined
        ? prev.project
        : (await normalizeProjectPath(String(body.project).trim())) || 'untitled'
    const t = updateTaskFields(id, {
      title: body.title ?? prev.title,
      project: normalizedProject,
      agent: body.agent ?? prev.agent,
      tag: body.tag === undefined ? prev.tag : body.tag,
      column_id: body.column_id ?? prev.column_id,
      position: body.position ?? prev.position,
    })

    // If this task is being placed in the in-progress column and it has a
    // supported agent, ensure a live run exists. This covers both the initial
    // move from todo -> in_progress and retries while the task is already
    // in_progress but its previous run has failed.
    let runId = null
    const shouldEnsureRun =
      body.column_id === 'in_progress' &&
      t.column_id === 'in_progress' &&
      (t.agent === 'codex' || t.agent === 'claude')
    if (shouldEnsureRun) {
      try {
        const run = await ensureRunForTask(t)
        runId = run?.id ?? null
      } catch (e) {
        return json(res, 500, { error: `failed to start ${t.agent}: ${e.message}` })
      }
    }
    return json(res, 200, { task: t, runId })
  }

  // DELETE /api/tasks/:id
  if (req.method === 'DELETE' && taskMatch) {
    deleteTask(taskMatch[1])
    return json(res, 200, { ok: true })
  }

  // GET /api/tasks/:id/run
  const runMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/)
  if (req.method === 'GET' && runMatch) {
    const task = getTask(runMatch[1])
    if (!task) return json(res, 404, { error: 'not found' })

    let run = getActiveRunForTask(task.id)
    if (
      !run &&
      (task.agent === 'codex' || task.agent === 'claude') &&
      task.column_id === 'in_progress'
    ) {
      try {
        run = await ensureRunForTask(task)
      } catch (e) {
        console.error('[tasks] failed to ensure run during fetch', e)
      }
    }
    if (!run) run = getLatestRunForTask(task.id)
    if (!run) return json(res, 200, { run: null, messages: [] })
    return json(res, 200, { run, messages: listMessages(run.id) })
  }

  return false // not handled
}
