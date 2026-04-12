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
import { BOARD_COLUMN_IDS } from '@agent-todo/shared/constants/board-columns'
import {
  DEFAULT_AGENT,
  getDefaultEffort,
  getDefaultModel,
  isAgent,
  sanitizeEffort,
  sanitizeFastMode,
  sanitizeModel,
} from '#domains/agents/agent-config.mjs'
import { DEFAULT_TASK_MODE, isTaskMode } from '#domains/agents/task-mode-config.mjs'
import { createProject } from '#domains/projects/project.repository.mjs'
import { listMessages } from '#domains/runs/message.repository.mjs'
import { getActiveRunForTask, getLatestRunForTask } from '#domains/runs/run.repository.mjs'
import { ensureRunForTask, stopRunForTask } from '#domains/runs/run-manager.mjs'
import { normalizeProjectPath } from '#infra/filesystem/project-path.mjs'
import { json, readBody } from '#infra/http/http.mjs'
import {
  createTask,
  deleteTask,
  getTask,
  listTaskStatuses,
  listTasks,
  updateTaskFields,
} from './task.repository.mjs'

function resolveColumnId(value, fallback = 'todo') {
  return BOARD_COLUMN_IDS.includes(value) ? value : fallback
}

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
    const agent = isAgent(body.agent) ? body.agent : DEFAULT_AGENT
    const model = sanitizeModel(agent, body.model ? String(body.model) : null)
    const fastMode = sanitizeFastMode(agent, model, body.fastMode)
    const projectPath =
      (await normalizeProjectPath(String(body.project || '').trim())) || 'untitled'
    const t = createTask({
      id,
      title: String(body.title || '').trim(),
      project: projectPath,
      agent,
      column_id: resolveColumnId(body.column_id),
      created_at: new Date().toISOString().slice(0, 10),
      mode: isTaskMode(body.mode) ? body.mode : DEFAULT_TASK_MODE,
      model,
      effort: sanitizeEffort(
        agent,
        model ?? getDefaultModel(agent),
        body.effort ?? getDefaultEffort(agent, model)
      ),
      fast_mode: fastMode,
    })
    if (projectPath && projectPath !== 'untitled') {
      createProject(projectPath)
    }
    return json(res, 201, { task: t })
  }

  // PATCH /api/tasks/:id
  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
  if (req.method === 'PATCH' && taskMatch) {
    const id = taskMatch[1]
    const body = await readBody(req)
    const prev = getTask(id)
    if (!prev) return json(res, 404, { error: 'not found' })
    const nextColumnId = resolveColumnId(body.column_id, prev.column_id)
    const nextPosition =
      typeof body.position === 'number'
        ? body.position
        : body.column_id !== undefined && nextColumnId !== prev.column_id
          ? 0
          : undefined
    const normalizedProject =
      body.project === undefined
        ? prev.project
        : (await normalizeProjectPath(String(body.project).trim())) || 'untitled'
    const nextAgent =
      body.agent === undefined ? prev.agent : isAgent(body.agent) ? body.agent : prev.agent
    const nextModel = sanitizeModel(
      nextAgent,
      body.model === undefined ? (prev.model ?? null) : body.model ? String(body.model) : null
    )
    const nextFastMode = sanitizeFastMode(
      nextAgent,
      nextModel,
      body.fastMode === undefined ? prev.fast_mode === true || prev.fast_mode === 1 : body.fastMode
    )
    const t = updateTaskFields(id, {
      title: body.title ?? prev.title,
      project: normalizedProject,
      agent: nextAgent,
      column_id: nextColumnId,
      position: nextPosition,
      mode:
        body.mode === undefined
          ? (prev.mode ?? DEFAULT_TASK_MODE)
          : isTaskMode(body.mode)
            ? body.mode
            : (prev.mode ?? DEFAULT_TASK_MODE),
      model: nextModel,
      effort: sanitizeEffort(
        nextAgent,
        nextModel ?? getDefaultModel(nextAgent),
        body.effort ?? prev.effort ?? getDefaultEffort(nextAgent, nextModel)
      ),
      fast_mode: nextFastMode,
    })

    const leftInProgress = prev.column_id === 'in_progress' && t.column_id !== 'in_progress'
    if (leftInProgress) {
      await stopRunForTask(t.id)
    }

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
    const task = getTask(taskMatch[1])
    if (!task) return json(res, 404, { error: 'not found' })
    if (!['backlog', 'todo'].includes(task.column_id)) {
      return json(res, 409, { error: 'only backlog and todo tasks can be deleted' })
    }
    await stopRunForTask(taskMatch[1])
    deleteTask(taskMatch[1])
    return json(res, 200, { ok: true })
  }

  // GET /api/tasks/:id/run
  const runMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/)
  if (req.method === 'GET' && runMatch) {
    const url = new URL(req.url, 'http://localhost')
    const task = getTask(runMatch[1])
    if (!task) return json(res, 404, { error: 'not found' })
    const autostart = url.searchParams.get('autostart') === 'true'

    let run = getActiveRunForTask(task.id)
    if (
      autostart &&
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
