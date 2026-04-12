import {
  getTaskTypeAllowedModes,
  getTaskTypeConfig,
  getTaskTypeLabel,
  getTaskTypeRecommendation,
  isTaskType,
  sanitizeTaskType,
  TASK_TYPE_EMPTY_SELECTION_HINT,
  TASK_TYPE_OPTIONS,
  TASK_TYPES,
  taskTypeAllowsMode,
  taskTypeRequiresProject,
} from '@agent-todo/shared/config/task-types'
import type { TaskType } from '#/entities/task/types'

const TASK_TYPE_BADGE_STYLES: Record<TaskType, string> = {
  feature_dev:
    'border-amber-700/30 bg-amber-100 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-100',
  feature_plan:
    'border-sky-700/30 bg-sky-100 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/15 dark:text-sky-100',
  code_review:
    'border-rose-700/30 bg-rose-100 text-rose-950 dark:border-rose-300/30 dark:bg-rose-400/15 dark:text-rose-100',
  write_tests:
    'border-emerald-700/30 bg-emerald-100 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-400/15 dark:text-emerald-100',
  brainstorming:
    'border-zinc-700/30 bg-zinc-100 text-zinc-950 dark:border-zinc-300/30 dark:bg-zinc-400/15 dark:text-zinc-100',
}

export function getTaskTypeBadgeClassName(taskType: TaskType) {
  return TASK_TYPE_BADGE_STYLES[taskType]
}

export {
  getTaskTypeAllowedModes,
  getTaskTypeConfig,
  getTaskTypeLabel,
  getTaskTypeRecommendation,
  isTaskType,
  sanitizeTaskType,
  TASK_TYPE_EMPTY_SELECTION_HINT,
  TASK_TYPE_OPTIONS,
  TASK_TYPES,
  taskTypeAllowsMode,
  taskTypeRequiresProject,
}
