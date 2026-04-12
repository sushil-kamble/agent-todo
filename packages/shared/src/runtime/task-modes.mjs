import sharedTaskConfig from '../config/task-config.json' with { type: 'json' }

const config = sharedTaskConfig

export const DEFAULT_TASK_MODE = config.defaultMode
export const TASK_MODE_OPTIONS = config.modes
export const TASK_MODES = TASK_MODE_OPTIONS.map(option => option.value)

export function isTaskMode(value) {
  return typeof value === 'string' && TASK_MODES.includes(value)
}
