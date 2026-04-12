import type { Agent, EffortLevel } from '../contracts/task'
import sharedConfig from './agent-model-config.json'

type EffortConfig = {
  label: string
  description: string
}

export type ModelConfig = {
  slug: string
  label: string
  isDefault?: boolean
  defaultEffort: EffortLevel
  efforts: EffortLevel[]
  supportsFastMode?: boolean
}

export type AgentConfig = {
  defaultModel: string
  models: ModelConfig[]
}

type SharedAgentConfig = {
  defaultAgent: Agent
  efforts: Record<EffortLevel, EffortConfig>
  agents: Record<Agent, AgentConfig>
}

const config = sharedConfig as SharedAgentConfig

export const AGENT_CONFIG = config
export const DEFAULT_AGENT = config.defaultAgent
export const AGENT_IDS = Object.keys(config.agents) as Agent[]
export const MODELS_BY_AGENT = Object.fromEntries(
  Object.entries(config.agents).map(([agent, value]) => [agent, value.models])
) as Record<Agent, ModelConfig[]>

export function isAgent(value: unknown): value is Agent {
  return typeof value === 'string' && AGENT_IDS.includes(value as Agent)
}

export function getAgentConfig(agent: Agent): AgentConfig {
  return config.agents[agent]
}

export function getEffortConfig(effort: EffortLevel): EffortConfig {
  return config.efforts[effort]
}

export function getDefaultModel(agent: Agent): string {
  return getAgentConfig(agent).defaultModel
}

export function sanitizeModel(agent: Agent, slug: string | null): string | null {
  if (typeof slug !== 'string' || !slug.trim()) return null
  return MODELS_BY_AGENT[agent].some(candidate => candidate.slug === slug) ? slug : null
}

export function getModelConfig(agent: Agent, slug: string | null): ModelConfig {
  const models = MODELS_BY_AGENT[agent]
  const effectiveSlug = sanitizeModel(agent, slug) ?? getDefaultModel(agent)
  const model = models.find(candidate => candidate.slug === effectiveSlug)
  if (!model) {
    throw new Error(`Unknown model "${effectiveSlug}" configured for ${agent}`)
  }
  return model
}

export function getModelLabel(agent: Agent, slug: string | null): string {
  return getModelConfig(agent, slug).label
}

export function modelSupportsFastMode(agent: Agent, slug: string | null): boolean {
  return getModelConfig(agent, slug).supportsFastMode === true
}

export function getEffortOptions(agent: Agent, slug: string | null) {
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

export function sanitizeEffort(
  agent: Agent,
  slug: string | null,
  effort: EffortLevel
): EffortLevel {
  const options = getEffortOptions(agent, slug)
  return options.some(option => option.value === effort) ? effort : getDefaultEffort(agent, slug)
}

export function sanitizeFastMode(agent: Agent, slug: string | null, fastMode: unknown): boolean {
  return modelSupportsFastMode(agent, slug) && fastMode === true
}

export function getEffortLabel(effort: EffortLevel): string {
  return getEffortConfig(effort).label
}
