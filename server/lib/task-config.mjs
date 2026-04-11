import sharedTaskConfig from '../../shared/task-config.json' with { type: 'json' }

const config = sharedTaskConfig

export const DEFAULT_TASK_MODE = config.defaultMode
export const TASK_MODES = config.modes.map(mode => mode.value)

export function isTaskMode(value) {
  return typeof value === 'string' && TASK_MODES.includes(value)
}
