import type { TaskMode } from '../contracts/task'
import sharedTaskConfig from './task-config.json'

export type TaskModeOption = {
  value: TaskMode
  label: string
  description: string
  requiresProject: boolean
}

type SharedTaskConfig = {
  defaultMode: TaskMode
  modes: TaskModeOption[]
}

const config = sharedTaskConfig as SharedTaskConfig

export const TASK_MODE_CONFIG = config
export const DEFAULT_TASK_MODE = config.defaultMode

/** The default mode to use when no project is selected. */
export const DEFAULT_PROJECTLESS_MODE: TaskMode =
  config.modes.find(m => !m.requiresProject)?.value ?? config.defaultMode
export const TASK_MODE_OPTIONS = config.modes
export const TASK_MODES = TASK_MODE_OPTIONS.map(option => option.value)

export function isTaskMode(value: unknown): value is TaskMode {
  return typeof value === 'string' && TASK_MODES.includes(value as TaskMode)
}

export function getTaskModeLabel(mode: TaskMode) {
  return TASK_MODE_OPTIONS.find(option => option.value === mode)?.label ?? mode
}

export function modeRequiresProject(mode: TaskMode): boolean {
  const entry = TASK_MODE_OPTIONS.find(option => option.value === mode)
  return entry?.requiresProject ?? true
}
