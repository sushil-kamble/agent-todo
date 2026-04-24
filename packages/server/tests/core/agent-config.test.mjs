import { describe, expect, it } from 'vitest'
import {
  getDefaultEffort,
  getDefaultModel,
  isAgent,
  sanitizeEffort,
  sanitizeFastMode,
  sanitizeModel,
} from '#domains/agents/agent-config.mjs'

describe('runtime agent config', () => {
  it('accepts only runtime agents', () => {
    expect(isAgent('claude')).toBe(true)
    expect(isAgent('codex')).toBe(true)
    expect(isAgent('code')).toBe(false)
  })

  it('uses the configured default model and effort for each runtime agent', () => {
    expect(getDefaultModel('claude')).toBe('claude-sonnet-4-6')
    expect(getDefaultEffort('claude', null)).toBe('medium')
    expect(getDefaultModel('codex')).toBe('gpt-5.5')
    expect(getDefaultEffort('codex', null)).toBe('medium')
  })

  it('drops models that do not belong to the selected runtime agent', () => {
    expect(sanitizeModel('claude', 'gpt-5.4')).toBeNull()
    expect(sanitizeModel('claude', 'claude-opus-4-7')).toBe('claude-opus-4-7')
    expect(sanitizeModel('codex', 'claude-opus-4-7')).toBeNull()
    expect(sanitizeModel('codex', 'gpt-5.5')).toBe('gpt-5.5')
    expect(sanitizeModel('codex', 'gpt-5.4')).toBe('gpt-5.4')
    expect(sanitizeModel('codex', 'gpt-5.3-codex')).toBe('gpt-5.3-codex')
  })

  it('falls back to the model default effort when the requested effort is unsupported', () => {
    expect(sanitizeEffort('claude', 'claude-haiku-4-5', 'max')).toBe('medium')
    expect(sanitizeEffort('claude', 'claude-opus-4-7', 'xhigh')).toBe('xhigh')
    expect(sanitizeEffort('codex', 'gpt-5.4-mini', 'max')).toBe('medium')
    expect(sanitizeEffort('codex', 'gpt-5.5', 'xhigh')).toBe('xhigh')
    expect(sanitizeEffort('codex', 'gpt-5.4', 'xhigh')).toBe('xhigh')
  })

  it('keeps fast mode enabled only for supported codex models', () => {
    expect(sanitizeFastMode('codex', 'gpt-5.5', true)).toBe(true)
    expect(sanitizeFastMode('codex', 'gpt-5.4', true)).toBe(true)
    expect(sanitizeFastMode('codex', 'gpt-5.3-codex', true)).toBe(false)
    expect(sanitizeFastMode('claude', null, true)).toBe(false)
  })
})
