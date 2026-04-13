import { describe, expect, it } from 'vitest'
import { toTaskCard, toTasksByColumn } from '../src/entities/task/mappers'

function buildServerTask(fast_mode) {
  return {
    id: 't-1',
    title: 'Task',
    project: '/tmp/project',
    agent: 'codex',
    column_id: 'todo',
    created_at: '2026-04-12',
    run_status: null,
    worked_time_ms: 62000,
    active_turn_started_at: '2026-04-12T10:00:00.000Z',
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

  it('maps worked time fields for board cards', () => {
    const task = toTaskCard(buildServerTask(0))

    expect(task.workedTimeMs).toBe(62000)
    expect(task.activeTurnStartedAt).toBe('2026-04-12T10:00:00.000Z')
  })

  it('groups backlog tasks into the backlog bucket', () => {
    const grouped = toTasksByColumn([
      buildServerTask(0),
      { ...buildServerTask(0), id: 't-backlog', column_id: 'backlog' },
    ])

    expect(grouped.backlog.map(task => task.id)).toEqual(['t-backlog'])
    expect(grouped.todo.map(task => task.id)).toEqual(['t-1'])
  })
})
