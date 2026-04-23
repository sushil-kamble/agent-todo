import { describe, expect, it } from 'vitest'
import {
  getAgentTooltipCopy,
  resolveAgentSelectionAfterSubscriptions,
  resolveAvailableTaskModes,
  resolveAvailableTaskTypes,
  resolveConstrainedTaskMode,
  resolveFormCopy,
  resolveInitialFormState,
  resolveModelSelectionState,
  resolveTaskCreationValidation,
} from '../src/features/task-editor/components/FormPanel'

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
        fastMode: false,
      },
      {
        agent: 'claude',
        mode: 'code',
        model: 'claude-haiku-4-5',
        effort: 'medium',
        fastMode: false,
      }
    )

    expect(state).toMatchObject({
      agent: 'codex',
      mode: 'code',
      model: null,
      effort: 'medium',
      fastMode: false,
      taskType: null,
    })
  })

  it('drops persisted fast mode when the selected model does not support it', () => {
    const state = resolveInitialFormState(null, {
      agent: 'codex',
      mode: 'code',
      model: 'gpt-5.3-codex',
      effort: 'medium',
      fastMode: true,
    })

    expect(state).toMatchObject({
      agent: 'codex',
      model: 'gpt-5.3-codex',
      effort: 'medium',
      fastMode: false,
      taskType: null,
    })
  })

  it('preserves the stored task type when editing an existing task', () => {
    const state = resolveInitialFormState(
      {
        id: 't-2',
        title: 'Plan the feature',
        project: '/tmp/project',
        agent: 'claude',
        createdAt: '2026-04-11',
        mode: 'ask',
        model: null,
        effort: 'high',
        fastMode: false,
        taskType: 'feature_plan',
      },
      {
        agent: 'codex',
        mode: 'code',
        model: null,
        effort: 'medium',
        fastMode: false,
      }
    )

    expect(state.taskType).toBe('feature_plan')
  })
})

describe('task type mode constraints', () => {
  it('shows only projectless-compatible task types when no project is selected', () => {
    expect(resolveAvailableTaskTypes({ hasProject: false }).map(option => option.value)).toEqual([
      'brainstorming',
    ])
  })

  it('shows all task types when a project is selected', () => {
    expect(resolveAvailableTaskTypes({ hasProject: true }).map(option => option.value)).toEqual([
      'feature_dev',
      'feature_plan',
      'code_review',
      'write_tests',
      'brainstorming',
    ])
  })

  it('filters mode options to the task type when one is selected', () => {
    expect(
      resolveAvailableTaskModes({
        taskType: 'feature_plan',
        hasProject: true,
      }).map(option => option.value)
    ).toEqual(['ask'])
  })

  it('keeps both feature development modes when a project is selected', () => {
    expect(
      resolveAvailableTaskModes({
        taskType: 'feature_dev',
        hasProject: true,
      }).map(option => option.value)
    ).toEqual(['code', 'ask'])
  })

  it('falls back to ask when the task type is ask-only', () => {
    expect(
      resolveConstrainedTaskMode({
        currentMode: 'code',
        taskType: 'code_review',
        hasProject: true,
      })
    ).toBe('ask')
  })

  it('falls back to ask when no project is selected', () => {
    expect(
      resolveConstrainedTaskMode({
        currentMode: 'code',
        taskType: null,
        hasProject: false,
      })
    ).toBe('ask')
  })

  it('keeps the selected mode when the task type itself requires a project', () => {
    expect(
      resolveConstrainedTaskMode({
        currentMode: 'code',
        taskType: 'feature_dev',
        hasProject: false,
      })
    ).toBe('code')
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
      taskType: null,
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
      taskType: null,
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
      taskType: null,
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
      taskType: null,
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

  it('requires a project for feature planning even though its mode is ask', () => {
    const result = resolveTaskCreationValidation({
      title: 'Plan the feature',
      project: '',
      projectOptions: ['/tmp/existing-project'],
      agent: 'claude',
      mode: 'ask',
      taskType: 'feature_plan',
      model: null,
      effort: 'high',
      subs: null,
    })

    expect(result).toEqual({
      missing: ['Project selection'],
      disabled: true,
    })
  })

  it('does not require a project for brainstorming', () => {
    const result = resolveTaskCreationValidation({
      title: 'Explore options',
      project: '',
      projectOptions: ['/tmp/existing-project'],
      agent: 'codex',
      mode: 'ask',
      taskType: 'brainstorming',
      model: null,
      effort: 'high',
      subs: null,
    })

    expect(result).toEqual({
      missing: [],
      disabled: false,
    })
  })
})

describe('form copy', () => {
  it('uses explicit task creation labels', () => {
    expect(
      resolveFormCopy({
        createKind: 'task',
        isEdit: false,
        editingColumn: null,
      })
    ).toEqual({
      panelTitle: 'Add Task',
      submitLabel: 'Create Task',
    })
  })

  it('uses explicit backlog creation labels', () => {
    expect(
      resolveFormCopy({
        createKind: 'backlog',
        isEdit: false,
        editingColumn: null,
      })
    ).toEqual({
      panelTitle: 'Add Backlog',
      submitLabel: 'Create Backlog',
    })
  })
})

describe('subscription-driven agent selection', () => {
  it('switches to the other runtime agent when the current one is unavailable', () => {
    expect(
      resolveAgentSelectionAfterSubscriptions('claude', {
        claude: {
          installed: true,
          plan: 'pro',
          available: false,
          reason: 'usage_exhausted',
          usage: null,
        },
        codex: {
          installed: true,
          plan: 'pro',
          available: true,
          reason: null,
          usage: null,
        },
      })
    ).toBe('codex')
  })

  it('keeps the current agent when both runtime agents are unavailable', () => {
    expect(
      resolveAgentSelectionAfterSubscriptions('codex', {
        claude: {
          installed: true,
          plan: 'pro',
          available: false,
          reason: 'login_required',
          usage: null,
        },
        codex: {
          installed: true,
          plan: 'pro',
          available: false,
          reason: 'usage_exhausted',
          usage: null,
        },
      })
    ).toBe('codex')
  })
})

describe('model selection state', () => {
  it('stores the default model as null instead of persisting its slug', () => {
    expect(
      resolveModelSelectionState({
        agent: 'codex',
        selectedModelSlug: 'gpt-5.4',
        preferredEffort: 'high',
        preferredFastMode: true,
      })
    ).toEqual({
      model: null,
      effort: 'high',
      fastMode: true,
    })
  })

  it('keeps explicit non-default model slugs', () => {
    expect(
      resolveModelSelectionState({
        agent: 'claude',
        selectedModelSlug: 'claude-opus-4-6',
        preferredEffort: 'max',
        preferredFastMode: true,
      })
    ).toEqual({
      model: 'claude-opus-4-6',
      effort: 'max',
      fastMode: false,
    })
  })

  it('resets unsupported effort and clears fast mode when switching models', () => {
    expect(
      resolveModelSelectionState({
        agent: 'codex',
        selectedModelSlug: 'gpt-5.4-mini',
        preferredEffort: 'max',
        preferredFastMode: true,
      })
    ).toEqual({
      model: 'gpt-5.4-mini',
      effort: 'medium',
      fastMode: false,
    })
  })
})

describe('agent tooltip copy', () => {
  it('describes agents that are not installed', () => {
    const copy = getAgentTooltipCopy({
      agent: 'claude',
      label: 'Claude',
      plan: null,
      reason: 'not_installed',
      usage: null,
    })

    expect(copy.title).toBe('Claude unavailable')
    expect(copy.body).toContain('not installed')
  })

  it('describes agents that need an active sign-in', () => {
    const copy = getAgentTooltipCopy({
      agent: 'codex',
      label: 'Codex',
      plan: null,
      reason: 'login_required',
      usage: null,
    })

    expect(copy.title).toBe('Codex needs sign-in')
    expect(copy.body).toContain('no active ChatGPT login')
  })

  it('describes live Codex plan, limits, and credits', () => {
    const copy = getAgentTooltipCopy({
      agent: 'codex',
      label: 'Codex',
      plan: 'pro',
      reason: null,
      usage: {
        fiveHourUtilization: 12,
        fiveHourResetsAt: '2026-04-12T18:30:00.000Z',
        sevenDayUtilization: 43,
        sevenDayResetsAt: '2026-04-18T18:30:00.000Z',
        creditsRemaining: 7,
        creditsUnlimited: false,
      },
    })

    expect(copy.title).toBe('Codex Pro')
    expect(copy.body).toContain('5h limit: 88% left')
    expect(copy.body).toContain('Weekly limit: 57% left')
    expect(copy.body).toContain('Credits: 7 remaining')
    expect(copy.body).toContain('resets')
  })

  it('explains Codex API key mode without inventing a plan', () => {
    const copy = getAgentTooltipCopy({
      agent: 'codex',
      label: 'Codex',
      plan: null,
      reason: 'api_key_auth',
      usage: null,
    })

    expect(copy).toEqual({
      title: 'Codex using API key',
      body: 'ChatGPT plan and ChatGPT usage limits are unavailable when Codex is authenticated with an API key.',
    })
  })

  it('shows usage verification status when live limits could not be confirmed', () => {
    const copy = getAgentTooltipCopy({
      agent: 'codex',
      label: 'Codex',
      plan: null,
      reason: 'usage_unverified',
      usage: null,
    })

    expect(copy.title).toBe('Codex available')
    expect(copy.body).toContain('could not be verified yet')
  })

  it('shows live limits even when no plan name is available', () => {
    const copy = getAgentTooltipCopy({
      agent: 'codex',
      label: 'Codex',
      plan: null,
      reason: null,
      usage: {
        fiveHourUtilization: 25,
        fiveHourResetsAt: '2026-04-12T18:30:00.000Z',
        sevenDayUtilization: null,
        sevenDayResetsAt: null,
        creditsRemaining: null,
        creditsUnlimited: null,
      },
    })

    expect(copy.title).toBe('Codex status')
    expect(copy.body).toContain('No ChatGPT subscription plan was detected')
    expect(copy.body).toContain('5h limit: 75% left')
  })

  it('shows exhausted Claude limits with reset guidance', () => {
    const copy = getAgentTooltipCopy({
      agent: 'claude',
      label: 'Claude',
      plan: 'max_5x',
      reason: 'usage_exhausted',
      usage: {
        fiveHourUtilization: 100,
        fiveHourResetsAt: '2026-04-12T18:30:00.000Z',
        sevenDayUtilization: 88,
        sevenDayResetsAt: '2026-04-18T18:30:00.000Z',
        creditsRemaining: null,
        creditsUnlimited: null,
      },
    })

    expect(copy.title).toBe('Claude limits exhausted')
    expect(copy.body).toContain('No remaining included capacity is available right now.')
    expect(copy.body).toContain('5h limit: 0% left')
    expect(copy.body).toContain('Weekly limit: 12% left')
    expect(copy.body).toContain('resets')
  })
})
