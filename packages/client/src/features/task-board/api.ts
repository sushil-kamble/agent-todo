import type {
  CreateTaskRequest,
  CreateTaskResponse,
  PatchTaskRequest,
  PatchTaskResponse,
  TaskListResponse,
  TaskStatusesResponse,
} from '@agent-todo/shared/contracts/task'
import { toTaskCard, toTasksByColumn } from '#/entities/task/mappers'
import type { ColumnId, TaskCard } from '#/entities/task/types'

export async function fetchTasks(): Promise<Record<ColumnId, TaskCard[]>> {
  const response = await fetch('/api/tasks')
  const body = (await response.json()) as TaskListResponse
  return toTasksByColumn(body.tasks)
}

export async function fetchTaskStatuses(taskIds: string[]): Promise<Record<string, string | null>> {
  if (taskIds.length === 0) return {}
  const query = new URLSearchParams({ ids: taskIds.join(',') })
  const response = await fetch(`/api/tasks/statuses?${query.toString()}`)
  const body = (await response.json()) as TaskStatusesResponse
  return body.statuses
}

export async function createTask(
  input: CreateTaskRequest
): Promise<{ task: TaskCard; column: ColumnId }> {
  const response = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = (await response.json()) as CreateTaskResponse
  return { task: toTaskCard(body.task), column: body.task.column_id }
}

export async function patchTask(
  id: string,
  updates: PatchTaskRequest
): Promise<{ task: TaskCard; column: ColumnId; runId: string | null }> {
  const response = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const body = (await response.json()) as PatchTaskResponse
  return { task: toTaskCard(body.task), column: body.task.column_id, runId: body.runId }
}

export async function deleteTask(id: string): Promise<void> {
  const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    const body = (await response.json()) as { error: string }
    throw new Error(body.error)
  }
}
