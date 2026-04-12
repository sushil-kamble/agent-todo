import {
  DEFAULT_TASK_MODE,
  getTaskModeLabel,
  isTaskMode,
  TASK_MODE_OPTIONS,
  TASK_MODES,
} from '@agent-todo/shared/config/task-modes'
import type { TaskMode } from '#/entities/task/types'

const TASK_MODE_BADGE_STYLES: Record<TaskMode, string> = {
  ask: 'border-sky-700/30 bg-sky-100 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/15 dark:text-sky-100',
  code: 'border-amber-700/30 bg-amber-100 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-100',
}

export function getTaskModeBadgeClassName(mode: TaskMode) {
  return TASK_MODE_BADGE_STYLES[mode]
}

export { DEFAULT_TASK_MODE, getTaskModeLabel, isTaskMode, TASK_MODE_OPTIONS, TASK_MODES }
