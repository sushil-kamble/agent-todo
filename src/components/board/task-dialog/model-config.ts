import sharedConfig from '../../../../shared/agent-model-config.json'
import type { Agent, EffortLevel } from '../types'

type EffortConfig = {
  label: string
  description: string
}

type ModelConfig = {
  slug: string
  label: string
  isDefault?: boolean
  defaultEffort: EffortLevel
  efforts: EffortLevel[]
}

type AgentConfig = {
  defaultModel: string
  models: ModelConfig[]
}

type SharedConfig = {
  efforts: Record<EffortLevel, EffortConfig>
  agents: Record<Agent, AgentConfig>
}

const config = sharedConfig as SharedConfig

function getAgentConfig(agent: Agent): AgentConfig {
  return config.agents[agent]
}

function getEffortConfig(effort: EffortLevel): EffortConfig {
  return config.efforts[effort]
}

export type ModelOption = ModelConfig

export type EffortOption = EffortConfig & {
  value: EffortLevel
  isDefault?: boolean
}

export const MODELS_BY_AGENT: Record<Agent, ModelOption[]> = Object.fromEntries(
  Object.entries(config.agents).map(([agent, agentConfig]) => [agent, agentConfig.models])
) as Record<Agent, ModelOption[]>

export function getDefaultModel(agent: Agent): string {
  return getAgentConfig(agent).defaultModel
}

export function getModelConfig(agent: Agent, slug: string | null): ModelOption {
  const models = MODELS_BY_AGENT[agent]
  const effectiveSlug = slug ?? getDefaultModel(agent)
  const model = models.find(candidate => candidate.slug === effectiveSlug)
  if (!model) {
    throw new Error(`Unknown model "${effectiveSlug}" configured for ${agent}`)
  }
  return model
}

export function getModelLabel(agent: Agent, slug: string | null): string {
  return getModelConfig(agent, slug).label
}

export function getEffortOptions(agent: Agent, slug: string | null): EffortOption[] {
  const model = getModelConfig(agent, slug)
  return model.efforts.map(value => ({
    value,
    label: getEffortConfig(value).label,
    description: getEffortConfig(value).description,
    isDefault: value === model.defaultEffort,
  }))
}

export function getDefaultEffort(agent: Agent, slug: string | null): EffortLevel {
  return getModelConfig(agent, slug).defaultEffort
}

export function sanitizeEffort(agent: Agent, slug: string | null, effort: EffortLevel): EffortLevel {
  const options = getEffortOptions(agent, slug)
  return options.some(option => option.value === effort) ? effort : getDefaultEffort(agent, slug)
}

export function getEffortLabel(effort: EffortLevel): string {
  return getEffortConfig(effort).label
}
