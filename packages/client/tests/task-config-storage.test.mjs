import { describe, expect, it } from 'vitest'
import {
  readStoredTaskConfig,
  resolveStoredTaskConfig,
  TASK_CONFIG_STORAGE_KEY,
  writeStoredTaskConfig,
} from '../src/features/task-editor/model/default-config-storage'

describe('task config storage', () => {
  it('returns defaults when storage is empty', () => {
    const storage = {
      getItem: () => null,
    }

    expect(readStoredTaskConfig(storage)).toEqual({
      agent: 'claude',
      mode: 'code',
      model: null,
      effort: 'medium',
      fastMode: false,
    })
  })

  it('keeps valid persisted selections', () => {
    expect(
      resolveStoredTaskConfig({
        agent: 'codex',
        mode: 'ask',
        model: 'gpt-5.3-codex',
        effort: 'xhigh',
        fastMode: true,
      })
    ).toEqual({
      agent: 'codex',
      mode: 'ask',
      model: 'gpt-5.3-codex',
      effort: 'xhigh',
      fastMode: false,
    })
  })

  it('drops invalid models and resets effort to a valid default', () => {
    expect(
      resolveStoredTaskConfig({
        agent: 'claude',
        mode: 'code',
        model: 'gpt-5.4',
        effort: 'xhigh',
      })
    ).toEqual({
      agent: 'claude',
      mode: 'code',
      model: null,
      effort: 'medium',
      fastMode: false,
    })
  })

  it('normalizes persisted config before writing', () => {
    let savedKey = null
    let savedValue = null
    const storage = {
      setItem: (key, value) => {
        savedKey = key
        savedValue = value
      },
    }

    writeStoredTaskConfig(
      {
        agent: 'claude',
        mode: 'ask',
        model: 'gpt-5.4',
        effort: 'xhigh',
        fastMode: true,
      },
      storage
    )

    expect(savedKey).toBe(TASK_CONFIG_STORAGE_KEY)
    expect(JSON.parse(savedValue)).toEqual({
      agent: 'claude',
      mode: 'ask',
      model: null,
      effort: 'medium',
      fastMode: false,
    })
  })

  it('ignores malformed JSON in storage', () => {
    const storage = {
      getItem: () => '{bad-json',
    }

    expect(readStoredTaskConfig(storage)).toEqual({
      agent: 'claude',
      mode: 'code',
      model: null,
      effort: 'medium',
      fastMode: false,
    })
  })
})
