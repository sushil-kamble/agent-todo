import {
  getTaskTypeAllowedModes,
  getTaskTypeRecommendation,
  isTaskType,
  TASK_TYPE_EMPTY_SELECTION_HINT,
  TASK_TYPE_OPTIONS,
  taskTypeRequiresProject,
} from '@agent-todo/shared/config/task-types'
import { describe, expect, it } from 'vitest'

describe('shared task type config', () => {
  it('accepts only registered task types', () => {
    expect(isTaskType('feature_dev')).toBe(true)
    expect(isTaskType('write_tests')).toBe(true)
    expect(isTaskType('not-real')).toBe(false)
    expect(isTaskType('')).toBe(false)
  })

  it('defines the expected info copy and visible task types', () => {
    expect(TASK_TYPE_EMPTY_SELECTION_HINT).toBe(
      "If you're not sure what you have to do, just keep it blank."
    )
    expect(TASK_TYPE_OPTIONS.map(option => option.value)).toEqual([
      'feature_dev',
      'feature_plan',
      'code_review',
      'write_tests',
      'brainstorming',
    ])
  })

  it('returns the correct allowed modes per task type', () => {
    expect(getTaskTypeAllowedModes('feature_dev')).toEqual(['ask', 'code'])
    expect(getTaskTypeAllowedModes('write_tests')).toEqual(['ask', 'code'])
    expect(getTaskTypeAllowedModes('feature_plan')).toEqual(['ask'])
    expect(getTaskTypeAllowedModes('code_review')).toEqual(['ask'])
    expect(getTaskTypeAllowedModes('brainstorming')).toEqual(['ask'])
  })

  it('marks project requirement only for the project-bound task types', () => {
    expect(taskTypeRequiresProject('feature_dev')).toBe(true)
    expect(taskTypeRequiresProject('feature_plan')).toBe(true)
    expect(taskTypeRequiresProject('code_review')).toBe(true)
    expect(taskTypeRequiresProject('write_tests')).toBe(true)
    expect(taskTypeRequiresProject('brainstorming')).toBe(false)
  })

  it('returns the configured recommendation for each runtime agent', () => {
    expect(getTaskTypeRecommendation('feature_plan', 'claude')).toEqual({
      model: 'claude-opus-4-7',
      effort: 'xhigh',
    })
    expect(
      TASK_TYPE_OPTIONS.map(option => getTaskTypeRecommendation(option.value, 'claude').model)
    ).toEqual([
      'claude-opus-4-7',
      'claude-opus-4-7',
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-sonnet-4-6',
    ])
    expect(getTaskTypeRecommendation('feature_plan', 'codex')).toEqual({
      model: 'gpt-5.5',
      effort: 'xhigh',
    })
    expect(
      TASK_TYPE_OPTIONS.map(option => getTaskTypeRecommendation(option.value, 'codex').model)
    ).toEqual(['gpt-5.5', 'gpt-5.5', 'gpt-5.5', 'gpt-5.5', 'gpt-5.5'])
    expect(getTaskTypeRecommendation('write_tests', 'claude')).toEqual({
      model: 'claude-sonnet-4-6',
      effort: 'high',
    })
    expect(getTaskTypeRecommendation('code_review', 'claude')).toEqual({
      model: 'claude-opus-4-7',
      effort: 'xhigh',
    })
  })
})
