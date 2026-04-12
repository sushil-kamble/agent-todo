/**
 * Agent registry — maps agent name to its client class.
 *
 * Adding a new agent:
 *   1. Create `server/agents/<name>.mjs` exporting a class with the same
 *      EventEmitter interface as CodexClient.
 *   2. Import it here and add to the `agents` map.
 */

import { ClaudeClient } from '#infra/agent-clients/claude.mjs'
import { CodexClient } from '#infra/agent-clients/codex.mjs'

const defaultAgents = {
  codex: CodexClient,
  claude: ClaudeClient,
}

let agents = { ...defaultAgents }

/**
 * Get the agent client class for a given agent name.
 * Throws if unknown.
 */
export function getAgentClass(name) {
  const Cls = agents[name]
  if (!Cls) throw new Error(`Unknown agent: ${name}`)
  return Cls
}

/**
 * Replace the runtime registry (used by tests/e2e fake harnesses).
 */
export function setAgentRegistry(nextRegistry) {
  if (!nextRegistry || typeof nextRegistry !== 'object') {
    throw new Error('setAgentRegistry expects a plain object map')
  }
  agents = { ...nextRegistry }
}

/**
 * Restore the built-in codex/claude registry.
 */
export function resetAgentRegistry() {
  agents = { ...defaultAgents }
}

/**
 * List registered agent names.
 */
export function listAgentNames() {
  return Object.keys(agents)
}
