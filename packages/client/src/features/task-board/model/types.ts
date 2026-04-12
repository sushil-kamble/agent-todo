import type { Agent, ColumnId, EffortLevel, TaskCard, TaskMode } from '#/entities/task/types'

export type TasksByColumn = Record<ColumnId, TaskCard[]>
export type TasksUpdater = TasksByColumn | ((current: TasksByColumn) => TasksByColumn)

export type CreateTaskInput = {
  title: string
  project: string
  agent: Agent
  column: ColumnId
  mode?: TaskMode
  model?: string | null
  effort?: EffortLevel
  fastMode?: boolean
}

export type UpdateTaskInput = {
  title: string
  project: string
  agent: Agent
  mode?: TaskMode
  model?: string | null
  effort?: EffortLevel
  fastMode?: boolean
}

const TASK_QUERY_PARAM = 'task'

export function createEmptyTasks(): TasksByColumn {
  return { backlog: [], todo: [], in_progress: [], done: [] }
}

export function applyTasksUpdate(current: TasksByColumn, updater: TasksUpdater): TasksByColumn {
  return typeof updater === 'function'
    ? (updater as (tasks: TasksByColumn) => TasksByColumn)(current)
    : updater
}

export function readTaskIdFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(TASK_QUERY_PARAM)
}

export function writeTaskIdToUrl(taskId: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (taskId) url.searchParams.set(TASK_QUERY_PARAM, taskId)
  else url.searchParams.delete(TASK_QUERY_PARAM)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}
