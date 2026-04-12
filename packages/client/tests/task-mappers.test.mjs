import { describe, expect, it } from 'vitest'
import { toTaskCard } from '../src/entities/task/mappers'

function buildServerTask(fast_mode) {
  return {
    id: 't-1',
    title: 'Task',
    project: '/tmp/project',
    agent: 'codex',
    tag: null,
    column_id: 'todo',
    created_at: '2026-04-12',
    run_status: null,
    mode: 'code',
    model: null,
    effort: 'medium',
    fast_mode,
  }
}

describe('task mappers', () => {
  it('normalizes fast_mode values into a boolean fastMode flag', () => {
    expect(toTaskCard(buildServerTask(1)).fastMode).toBe(true)
    expect(toTaskCard(buildServerTask(true)).fastMode).toBe(true)
    expect(toTaskCard(buildServerTask(0)).fastMode).toBe(false)
    expect(toTaskCard(buildServerTask(false)).fastMode).toBe(false)
  })
})
