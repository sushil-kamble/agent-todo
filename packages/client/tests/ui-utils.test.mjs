import { describe, expect, it } from 'vitest'
import { formatWorkedFor, groupByTurn } from '../src/features/run-console/model/utils'

describe('task dialog utils', () => {
  it('groups by user boundaries and separates final messages for completed turns', () => {
    const messages = [
      {
        id: 'u-1',
        role: 'user',
        kind: 'text',
        body: 'first',
        at: '10:00',
        createdAt: '2026-01-01T10:00:00.000Z',
      },
      {
        id: 'a-1',
        role: 'agent',
        kind: 'text',
        body: 'thinking',
        at: '10:00',
        createdAt: '2026-01-01T10:00:01.000Z',
        phase: 'commentary',
      },
      {
        id: 'a-2',
        role: 'agent',
        kind: 'text',
        body: 'answer',
        at: '10:01',
        createdAt: '2026-01-01T10:01:00.000Z',
        phase: 'final',
      },
      {
        id: 'u-2',
        role: 'user',
        kind: 'text',
        body: 'second',
        at: '10:02',
        createdAt: '2026-01-01T10:02:00.000Z',
      },
      {
        id: 'a-3',
        role: 'agent',
        kind: 'text',
        body: 'streaming reply',
        at: '10:02',
        createdAt: '2026-01-01T10:02:01.000Z',
        streaming: true,
      },
    ]

    const groups = groupByTurn(messages, 1)

    expect(groups).toHaveLength(2)
    expect(groups[0].user?.id).toBe('u-1')
    expect(groups[0].final?.id).toBe('a-2')
    expect(groups[0].supporting.map(message => message.id)).toEqual(['a-1'])
    expect(groups[0].tail).toEqual([])

    expect(groups[1].user?.id).toBe('u-2')
    expect(groups[1].final).toBeNull()
    expect(groups[1].supporting.map(message => message.id)).toEqual(['a-3'])
    expect(groups[1].tail).toEqual([])
  })

  it('keeps non-user prefixed runs in a safe synthetic group', () => {
    const groups = groupByTurn(
      [
        {
          id: 's-1',
          role: 'system',
          kind: 'status',
          body: 'Bootstrapping',
          at: '10:00',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
      ],
      0
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].user).toBeNull()
    expect(groups[0].supporting[0].id).toBe('s-1')
    expect(groups[0].tail).toEqual([])
  })

  it('hides all agent output for a turn once the user interruption marker appears', () => {
    const groups = groupByTurn(
      [
        {
          id: 'u-1',
          role: 'user',
          kind: 'text',
          body: 'ship it',
          at: '10:00',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'a-1',
          role: 'agent',
          kind: 'text',
          body: 'working',
          at: '10:00',
          createdAt: '2026-01-01T10:00:01.000Z',
          phase: 'commentary',
        },
        {
          id: 'a-2',
          role: 'agent',
          kind: 'text',
          body: 'done',
          at: '10:01',
          createdAt: '2026-01-01T10:01:00.000Z',
        },
        {
          id: 's-2',
          role: 'system',
          kind: 'error',
          body: '--- User cancelled execution ---',
          at: '10:01',
          createdAt: '2026-01-01T10:01:05.000Z',
          interruptedByUser: true,
        },
      ],
      1
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].final).toBeNull()
    expect(groups[0].supporting).toEqual([])
    expect(groups[0].interrupted?.id).toBe('s-2')
    expect(groups[0].tail).toEqual([])
  })

  it('hides in-flight agent output when an interruption happens before a final answer', () => {
    const groups = groupByTurn(
      [
        {
          id: 'u-1',
          role: 'user',
          kind: 'text',
          body: 'inspect repo',
          at: '10:00',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'a-1',
          role: 'agent',
          kind: 'text',
          body: 'Looking through the project now',
          at: '10:00',
          createdAt: '2026-01-01T10:00:01.000Z',
          phase: 'commentary',
        },
        {
          id: 's-2',
          role: 'system',
          kind: 'error',
          body: '--- User cancelled execution ---',
          at: '10:01',
          createdAt: '2026-01-01T10:01:05.000Z',
          interruptedByUser: true,
        },
      ],
      0
    )

    expect(groups).toHaveLength(1)
    expect(groups[0].final).toBeNull()
    expect(groups[0].supporting).toEqual([])
    expect(groups[0].interrupted?.id).toBe('s-2')
    expect(groups[0].tail).toEqual([])
  })

  it('only treats explicit final-phase agent text as the final answer', () => {
    const groups = groupByTurn(
      [
        {
          id: 'u-1',
          role: 'user',
          kind: 'text',
          body: 'explain the fix',
          at: '10:00',
          createdAt: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'a-1',
          role: 'agent',
          kind: 'text',
          body: 'Preamble',
          at: '10:00',
          createdAt: '2026-01-01T10:00:01.000Z',
          phase: 'commentary',
        },
        {
          id: 'r-1',
          role: 'agent',
          kind: 'reasoning',
          body: 'Visible reasoning summary',
          at: '10:00',
          createdAt: '2026-01-01T10:00:02.000Z',
          provider: 'claude',
          reasoningFormat: 'summary',
        },
        {
          id: 'a-2',
          role: 'agent',
          kind: 'text',
          body: 'Final answer',
          at: '10:01',
          createdAt: '2026-01-01T10:01:00.000Z',
          phase: 'final',
        },
      ],
      1
    )

    expect(groups[0].final?.id).toBe('a-2')
    expect(groups[0].supporting.map(message => message.id)).toEqual(['a-1', 'r-1'])
  })

  it('formats worked-for durations for seconds, minutes, and hours', () => {
    expect(formatWorkedFor('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:07.000Z')).toBe(
      'Worked for 7s'
    )

    expect(formatWorkedFor('2026-01-01T00:00:00.000Z', '2026-01-01T00:01:05.000Z')).toBe(
      'Worked for 1m 5s'
    )

    expect(formatWorkedFor('2026-01-01T00:00:00.000Z', '2026-01-01T01:01:05.000Z')).toBe(
      'Worked for 1h 1m'
    )
  })

  it('returns null for invalid timestamps', () => {
    expect(formatWorkedFor(undefined, '2026-01-01T00:00:07.000Z')).toBeNull()
    expect(formatWorkedFor('invalid', '2026-01-01T00:00:07.000Z')).toBeNull()
    expect(formatWorkedFor('2026-01-01T00:00:00.000Z', 'invalid')).toBeNull()
  })
})
