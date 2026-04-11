import sharedTaskConfig from '../../../../shared/task-config.json'
import type { TaskMode } from '../types'

type TaskModeOption = {
  value: TaskMode
  label: string
  description: string
}

type SharedTaskConfig = {
  defaultMode: TaskMode
  modes: TaskModeOption[]
}

const config = sharedTaskConfig as SharedTaskConfig

export const DEFAULT_TASK_MODE = config.defaultMode
export const TASK_MODE_OPTIONS = config.modes
export const TASK_MODES = TASK_MODE_OPTIONS.map(option => option.value)

const TASK_MODE_BADGE_STYLES: Record<TaskMode, string> = {
  ask: 'border-sky-700/30 bg-sky-100 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/15 dark:text-sky-100',
  code: 'border-amber-700/30 bg-amber-100 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-100',
}

export function isTaskMode(value: unknown): value is TaskMode {
  return typeof value === 'string' && TASK_MODES.includes(value as TaskMode)
}

export function getTaskModeLabel(mode: TaskMode) {
  return TASK_MODE_OPTIONS.find(option => option.value === mode)?.label ?? mode
}

export function getTaskModeBadgeClassName(mode: TaskMode) {
  return TASK_MODE_BADGE_STYLES[mode]
}
