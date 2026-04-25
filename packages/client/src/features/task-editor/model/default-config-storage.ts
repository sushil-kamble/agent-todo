import type { Agent, EffortLevel, TaskMode } from '#/entities/task/types'
import {
  DEFAULT_AGENT,
  getDefaultEffort,
  getEffortOptions,
  isAgent,
  sanitizeFastMode,
  sanitizeModel,
} from '#/features/agent-config/model/model-config'
import { DEFAULT_TASK_MODE, isTaskMode } from '#/features/agent-config/model/task-config'

export type StoredTaskConfig = {
  agent: Agent
  mode: TaskMode
  model: string | null
  effort: EffortLevel
  fastMode: boolean
}

export const TASK_CONFIG_STORAGE_KEY = 'agentodo-task-config'

const DEFAULT_TASK_CONFIG: StoredTaskConfig = {
  agent: DEFAULT_AGENT,
  mode: DEFAULT_TASK_MODE,
  model: null,
  effort: getDefaultEffort(DEFAULT_AGENT, null),
  fastMode: false,
}

function normalizeModel(agent: Agent, value: unknown): string | null {
  return sanitizeModel(agent, typeof value === 'string' ? value : null)
}

export function resolveStoredTaskConfig(value: unknown): StoredTaskConfig {
  const input = value && typeof value === 'object' ? value : {}
  const agent = isAgent((input as Record<string, unknown>).agent)
    ? (input as Record<string, Agent>).agent
    : DEFAULT_TASK_CONFIG.agent
  const mode = isTaskMode((input as Record<string, unknown>).mode)
    ? (input as Record<string, TaskMode>).mode
    : DEFAULT_TASK_CONFIG.mode
  const model = normalizeModel(agent, (input as Record<string, unknown>).model)
  const effortOptions = getEffortOptions(agent, model)
  const rawEffort = (input as Record<string, unknown>).effort
  const effort =
    typeof rawEffort === 'string' && effortOptions.some(option => option.value === rawEffort)
      ? (rawEffort as EffortLevel)
      : getDefaultEffort(agent, model)
  const fastMode = sanitizeFastMode(agent, model, (input as Record<string, unknown>).fastMode)

  return { agent, mode, model, effort, fastMode }
}

export function readStoredTaskConfig(
  storage: Pick<Storage, 'getItem'> | null | undefined = typeof window === 'undefined'
    ? undefined
    : window.localStorage
): StoredTaskConfig {
  if (!storage) return DEFAULT_TASK_CONFIG

  try {
    const stored = storage.getItem(TASK_CONFIG_STORAGE_KEY)
    if (!stored) return DEFAULT_TASK_CONFIG
    return resolveStoredTaskConfig(JSON.parse(stored))
  } catch {
    return DEFAULT_TASK_CONFIG
  }
}

export function writeStoredTaskConfig(
  config: StoredTaskConfig,
  storage: Pick<Storage, 'setItem'> | null | undefined = typeof window === 'undefined'
    ? undefined
    : window.localStorage
) {
  if (!storage) return
  storage.setItem(TASK_CONFIG_STORAGE_KEY, JSON.stringify(resolveStoredTaskConfig(config)))
}
