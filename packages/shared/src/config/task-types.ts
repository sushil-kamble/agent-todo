import type { Agent, EffortLevel, TaskMode, TaskType } from '../contracts/task'
import sharedTaskTypeConfig from './task-types.json'

export type TaskTypeRecommendation = {
  model: string
  effort: EffortLevel
}

export type TaskTypeOption = {
  value: TaskType
  label: string
  description: string
  requiresProject: boolean
  allowedModes: TaskMode[]
  promptKey: string
  recommendations: Record<Agent, TaskTypeRecommendation>
}

type SharedTaskTypeConfig = {
  emptySelectionHint: string
  types: TaskTypeOption[]
}

const config = sharedTaskTypeConfig as SharedTaskTypeConfig

export const TASK_TYPE_CONFIG = config
export const TASK_TYPE_EMPTY_SELECTION_HINT = config.emptySelectionHint
export const TASK_TYPE_OPTIONS = config.types
export const TASK_TYPES = TASK_TYPE_OPTIONS.map(option => option.value)

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === 'string' && TASK_TYPES.includes(value as TaskType)
}

export function getTaskTypeConfig(taskType: TaskType) {
  const option = TASK_TYPE_OPTIONS.find(candidate => candidate.value === taskType)
  if (!option) {
    throw new Error(`Unknown task type "${taskType}"`)
  }
  return option
}

export function getTaskTypeLabel(taskType: TaskType) {
  return getTaskTypeConfig(taskType).label
}

export function getTaskTypeAllowedModes(taskType: TaskType) {
  return getTaskTypeConfig(taskType).allowedModes
}

export function taskTypeRequiresProject(taskType: TaskType) {
  return getTaskTypeConfig(taskType).requiresProject === true
}

export function taskTypeAllowsMode(taskType: TaskType, mode: TaskMode) {
  return getTaskTypeAllowedModes(taskType).includes(mode)
}

export function getTaskTypeRecommendation(taskType: TaskType, agent: Agent) {
  return getTaskTypeConfig(taskType).recommendations[agent]
}

export function sanitizeTaskType(value: unknown): TaskType | null {
  return isTaskType(value) ? value : null
}
