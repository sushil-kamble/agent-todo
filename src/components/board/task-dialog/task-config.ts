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

export function isTaskMode(value: unknown): value is TaskMode {
  return typeof value === 'string' && TASK_MODES.includes(value as TaskMode)
}
