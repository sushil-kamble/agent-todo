import {
  getDefaultEffort,
  getDefaultModel,
  getModelConfig,
  isAgent,
  modelSupportsFastMode,
  sanitizeEffort,
  sanitizeFastMode,
  sanitizeModel,
} from '@agent-todo/shared/config/agents'
import { describe, expect, it } from 'vitest'

describe('shared agent model config', () => {
  it('accepts only registered runtime agents', () => {
    expect(isAgent('claude')).toBe(true)
    expect(isAgent('codex')).toBe(true)
    expect(isAgent('code')).toBe(false)
    expect(isAgent('not-real')).toBe(false)
  })

  it('returns stable default models and efforts per agent', () => {
    expect(getDefaultModel('claude')).toBe('claude-sonnet-4-6')
    expect(getDefaultEffort('claude', null)).toBe('medium')
    expect(getDefaultModel('codex')).toBe('gpt-5.4')
    expect(getDefaultEffort('codex', null)).toBe('medium')
  })

  it('rejects blank, unknown, and cross-agent model slugs', () => {
    expect(sanitizeModel('claude', '')).toBeNull()
    expect(sanitizeModel('claude', '  ')).toBeNull()
    expect(sanitizeModel('claude', 'gpt-5.4')).toBeNull()
    expect(sanitizeModel('codex', 'claude-haiku-4-5')).toBeNull()
    expect(sanitizeModel('codex', 'gpt-5.3-codex')).toBe('gpt-5.3-codex')
  })

  it('resolves the default model config when no explicit slug is set', () => {
    expect(getModelConfig('claude', null).slug).toBe('claude-sonnet-4-6')
    expect(getModelConfig('codex', null).slug).toBe('gpt-5.4')
  })

  it('falls back to the model default effort when the effort is unsupported', () => {
    expect(sanitizeEffort('claude', 'claude-haiku-4-5', 'max')).toBe('medium')
    expect(sanitizeEffort('codex', 'gpt-5.4-mini', 'max')).toBe('medium')
    expect(sanitizeEffort('codex', 'gpt-5.4', 'xhigh')).toBe('xhigh')
  })

  it('enables fast mode only for codex gpt-5.4', () => {
    expect(modelSupportsFastMode('codex', 'gpt-5.4')).toBe(true)
    expect(modelSupportsFastMode('codex', 'gpt-5.3-codex')).toBe(false)
    expect(modelSupportsFastMode('claude', null)).toBe(false)
    expect(sanitizeFastMode('codex', 'gpt-5.4', true)).toBe(true)
    expect(sanitizeFastMode('codex', 'gpt-5.4-mini', true)).toBe(false)
    expect(sanitizeFastMode('claude', null, true)).toBe(false)
  })
})
