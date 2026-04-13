import type { ServerTask, TaskCard } from '@agent-todo/shared/contracts/task'
import type { TasksByColumn } from '#/features/task-board/model/types'

export function toTaskCard(task: ServerTask): TaskCard {
  return {
    id: task.id,
    title: task.title,
    project: task.project,
    agent: task.agent,
    createdAt: task.created_at,
    runStatus: task.run_status ?? undefined,
    workedTimeMs: task.worked_time_ms ?? null,
    activeTurnStartedAt: task.active_turn_started_at ?? null,
    mode: task.mode ?? 'code',
    model: task.model ?? null,
    effort: task.effort ?? 'medium',
    fastMode: task.fast_mode === true || task.fast_mode === 1,
    taskType: task.task_type ?? null,
  }
}

export function toTasksByColumn(tasks: ServerTask[]): TasksByColumn {
  const columns: TasksByColumn = {
    backlog: [],
    todo: [],
    in_progress: [],
    done: [],
  }

  for (const task of tasks) {
    columns[task.column_id].push(toTaskCard(task))
  }

  return columns
}
