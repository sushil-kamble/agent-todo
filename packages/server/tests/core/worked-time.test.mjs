import { describe, expect, it } from 'vitest'
import { summarizeRunWorkedTime } from '#domains/runs/worked-time.mjs'

describe('worked time summary', () => {
  it('sums completed turns and excludes idle gaps between follow-ups', () => {
    const run = {
      id: 'r-1',
      status: 'idle',
      created_at: '2026-04-14T09:00:00.000Z',
    }

    const messages = [
      {
        role: 'user',
        created_at: '2026-04-14T09:00:00.000Z',
      },
      {
        role: 'agent',
        created_at: '2026-04-14T09:00:10.000Z',
      },
      {
        role: 'user',
        created_at: '2026-04-14T09:05:00.000Z',
      },
      {
        role: 'system',
        created_at: '2026-04-14T09:05:20.000Z',
      },
    ]

    expect(summarizeRunWorkedTime(run, messages)).toEqual({
      total_ms: 30000,
      active_turn_started_at: null,
    })
  })

  it('keeps the current turn live instead of counting it into the stored total', () => {
    const run = {
      id: 'r-2',
      status: 'active',
      created_at: '2026-04-14T09:00:00.000Z',
    }

    const messages = [
      {
        role: 'user',
        created_at: '2026-04-14T09:00:00.000Z',
      },
      {
        role: 'agent',
        created_at: '2026-04-14T09:00:12.000Z',
      },
      {
        role: 'user',
        created_at: '2026-04-14T09:03:00.000Z',
      },
      {
        role: 'agent',
        created_at: '2026-04-14T09:03:05.000Z',
      },
    ]

    expect(summarizeRunWorkedTime(run, messages)).toEqual({
      total_ms: 12000,
      active_turn_started_at: '2026-04-14T09:03:00.000Z',
    })
  })
})
