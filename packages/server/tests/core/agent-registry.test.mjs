import { describe, expect, it } from 'vitest'
import {
  getAgentClass,
  listAgentNames,
  resetAgentRegistry,
  setAgentRegistry,
} from '#domains/agents/agent-registry.mjs'

class CustomClaudeAgent {}
class CustomCodexAgent {}

describe('agent registry', () => {
  it('returns built-in runtime agents by default', () => {
    resetAgentRegistry()
    expect(listAgentNames().sort()).toEqual(['claude', 'codex'])
    expect(typeof getAgentClass('claude')).toBe('function')
    expect(typeof getAgentClass('codex')).toBe('function')
  })

  it('throws for unknown runtime agents', () => {
    resetAgentRegistry()
    expect(() => getAgentClass('not-real')).toThrow('Unknown agent: not-real')
  })

  it('replaces and resets the registry map', () => {
    setAgentRegistry({
      claude: CustomClaudeAgent,
      codex: CustomCodexAgent,
    })

    expect(getAgentClass('claude')).toBe(CustomClaudeAgent)
    expect(getAgentClass('codex')).toBe(CustomCodexAgent)
    expect(listAgentNames().sort()).toEqual(['claude', 'codex'])

    resetAgentRegistry()
    expect(getAgentClass('claude')).not.toBe(CustomClaudeAgent)
    expect(getAgentClass('codex')).not.toBe(CustomCodexAgent)
  })

  it('rejects non-object registry replacements', () => {
    expect(() => setAgentRegistry(null)).toThrow('setAgentRegistry expects a plain object map')
  })
})
