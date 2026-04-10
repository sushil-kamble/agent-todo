import sharedConfig from '../../shared/agent-model-config.json' with { type: 'json' }

const config = sharedConfig

function getAgentConfig(agent) {
  return config.agents[agent]
}

export function getDefaultModel(agent) {
  return getAgentConfig(agent).defaultModel
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

export function sanitizeEffort(agent, slug, effort) {
  const model = getModelConfig(agent, slug)
  return model.efforts.includes(effort) ? effort : model.defaultEffort
}
