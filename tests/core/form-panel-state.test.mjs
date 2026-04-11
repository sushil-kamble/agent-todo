import { describe, expect, it } from 'vitest'
import {
  resolveInitialFormState,
  resolveTaskCreationValidation,
} from '../../src/components/board/task-dialog/FormPanel'

describe('form panel initial state', () => {
  it('does not apply a stored Claude model to an edited Codex task with no explicit model', () => {
    const state = resolveInitialFormState(
      {
        id: 't-1',
        title: 'Codex task',
        project: '/tmp/project',
        agent: 'codex',
        createdAt: '2026-04-11',
        mode: 'code',
        model: null,
        effort: 'medium',
      },
      {
        agent: 'claude',
        mode: 'code',
        model: 'claude-haiku-4-5',
        effort: 'medium',
      }
    )

    expect(state).toMatchObject({
      agent: 'codex',
      mode: 'code',
      model: null,
      effort: 'medium',
    })
  })
})

describe('task creation validation', () => {
  it('requires a registered project selection before enabling task creation', () => {
    const result = resolveTaskCreationValidation({
      title: 'Ship the fix',
      project: '/tmp/new-project',
      projectOptions: ['/tmp/existing-project'],
      agent: 'codex',
      mode: 'code',
      model: null,
      effort: 'medium',
      subs: null,
    })

    expect(result).toEqual({
      missing: ['Project selection'],
      disabled: true,
    })
  })

  it('marks assignment as missing when the selected agent is unavailable', () => {
    const result = resolveTaskCreationValidation({
      title: 'Ship the fix',
      project: '/tmp/existing-project',
      projectOptions: ['/tmp/existing-project'],
      agent: 'claude',
      mode: 'code',
      model: null,
      effort: 'medium',
      subs: {
        claude: {
          installed: true,
          plan: 'pro',
          available: false,
          reason: 'usage_exhausted',
          usage: null,
        },
        codex: {
          installed: true,
          plan: null,
          available: true,
          reason: null,
          usage: null,
        },
      },
    })

    expect(result).toEqual({
      missing: ['Assigned to'],
      disabled: true,
    })
  })

  it('marks configuration as missing when the selected configuration is invalid', () => {
    const result = resolveTaskCreationValidation({
      title: 'Ship the fix',
      project: '/tmp/existing-project',
      projectOptions: ['/tmp/existing-project'],
      agent: 'codex',
      mode: 'code',
      model: null,
      effort: 'not-real',
      subs: null,
    })

    expect(result).toEqual({
      missing: ['Configuration'],
      disabled: true,
    })
  })

  it('enables task creation when all required selections are present', () => {
    const result = resolveTaskCreationValidation({
      title: 'Ship the fix',
      project: '/tmp/existing-project',
      projectOptions: ['/tmp/existing-project'],
      agent: 'codex',
      mode: 'code',
      model: null,
      effort: 'medium',
      subs: {
        claude: {
          installed: true,
          plan: 'pro',
          available: true,
          reason: null,
          usage: null,
        },
        codex: {
          installed: true,
          plan: null,
          available: true,
          reason: null,
          usage: null,
        },
      },
    })

    expect(result).toEqual({
      missing: [],
      disabled: false,
    })
  })
})
