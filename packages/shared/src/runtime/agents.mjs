import sharedConfig from '../config/agent-model-config.json' with { type: 'json' }

const config = sharedConfig

export const DEFAULT_AGENT = config.defaultAgent
export const AGENT_IDS = Object.keys(config.agents)

export function isAgent(value) {
  return typeof value === 'string' && AGENT_IDS.includes(value)
}

function getAgentConfig(agent) {
  return config.agents[agent]
}

export function getDefaultModel(agent) {
  return getAgentConfig(agent).defaultModel
}

export function sanitizeModel(agent, slug) {
  if (typeof slug !== 'string' || !slug.trim()) return null
  const models = getAgentConfig(agent).models
  return models.some(candidate => candidate.slug === slug) ? slug : null
}

export function getModelConfig(agent, slug) {
  const models = getAgentConfig(agent).models
  const effectiveSlug = slug ?? getDefaultModel(agent)
  const model = models.find(candidate => candidate.slug === effectiveSlug)
  if (!model) {
    throw new Error(`Unknown model "${effectiveSlug}" configured for ${agent}`)
  }
  return model
}

export function getDefaultEffort(agent, slug) {
  return getModelConfig(agent, slug).defaultEffort
}

export function modelSupportsFastMode(agent, slug) {
  return getModelConfig(agent, slug).supportsFastMode === true
}

export function sanitizeEffort(agent, slug, effort) {
  const model = getModelConfig(agent, slug)
  return model.efforts.includes(effort) ? effort : model.defaultEffort
}

export function sanitizeFastMode(agent, slug, fastMode) {
  return modelSupportsFastMode(agent, slug) && fastMode === true
}
