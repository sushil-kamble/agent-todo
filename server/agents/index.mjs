/**
 * Agent registry — maps agent name to its client class.
 *
 * Adding a new agent:
 *   1. Create `server/agents/<name>.mjs` exporting a class with the same
 *      EventEmitter interface as CodexClient.
 *   2. Import it here and add to the `agents` map.
 */
import { CodexClient } from './codex.mjs'

const agents = {
  codex: CodexClient,
  // claude: ClaudeClient,  ← future
}

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
 * List registered agent names.
 */
export function listAgentNames() {
  return Object.keys(agents)
}
