import sharedTaskTypeConfig from '../config/task-types.json' with { type: 'json' }

const config = sharedTaskTypeConfig

export const TASK_TYPE_EMPTY_SELECTION_HINT = config.emptySelectionHint
export const TASK_TYPE_OPTIONS = config.types
export const TASK_TYPES = TASK_TYPE_OPTIONS.map(option => option.value)

export function isTaskType(value) {
  return typeof value === 'string' && TASK_TYPES.includes(value)
}

export function getTaskTypeConfig(taskType) {
  return TASK_TYPE_OPTIONS.find(option => option.value === taskType) ?? null
}

export function getTaskTypeAllowedModes(taskType) {
  return getTaskTypeConfig(taskType)?.allowedModes ?? []
}

export function taskTypeRequiresProject(taskType) {
  return getTaskTypeConfig(taskType)?.requiresProject === true
}

export function taskTypeAllowsMode(taskType, mode) {
  return getTaskTypeAllowedModes(taskType).includes(mode)
}

export function getTaskTypeRecommendation(taskType, agent) {
  return getTaskTypeConfig(taskType)?.recommendations?.[agent] ?? null
}

export function sanitizeTaskType(value) {
  return isTaskType(value) ? value : null
}
