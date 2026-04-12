import type { ServerTask, TaskCard } from '@agent-todo/shared/contracts/task'
import type { TasksByColumn } from '#/features/task-board/model/types'

export function toTaskCard(task: ServerTask): TaskCard {
  return {
    id: task.id,
    title: task.title,
    project: task.project,
    agent: task.agent,
    tag: task.tag ?? undefined,
    createdAt: task.created_at,
    runStatus: task.run_status ?? undefined,
    mode: task.mode ?? 'code',
    model: task.model ?? null,
    effort: task.effort ?? 'medium',
    fastMode: task.fast_mode === true || task.fast_mode === 1,
  }
}

export function toTasksByColumn(tasks: ServerTask[]): TasksByColumn {
  const columns: TasksByColumn = {
    todo: [],
    in_progress: [],
    done: [],
  }

  for (const task of tasks) {
    columns[task.column_id].push(toTaskCard(task))
  }

  return columns
}
