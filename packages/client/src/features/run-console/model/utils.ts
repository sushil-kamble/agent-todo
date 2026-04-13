import type { LiveMessage, TurnGroup } from './types'

function isUserInterruptedMarker(message: LiveMessage) {
  return message.role === 'system' && message.kind === 'error' && message.interruptedByUser === true
}

export function groupByTurn(messages: LiveMessage[], completedTurns: number): TurnGroup[] {
  type RawGroup = { user: LiveMessage | null; items: LiveMessage[] }
  const raw: RawGroup[] = []
  let cur: RawGroup | null = null

  for (const m of messages) {
    if (m.role === 'user') {
      cur = { user: m, items: [] }
      raw.push(cur)
      continue
    }
    if (!cur) {
      cur = { user: null, items: [] }
      raw.push(cur)
    }
    cur.items.push(m)
  }

  return raw.map(({ user, items }, groupIdx) => {
    const turnDone = groupIdx < completedTurns
    const interrupted = items.find(isUserInterruptedMarker) ?? null
    const startedAt = user?.createdAt ?? items.find(m => !!m.createdAt)?.createdAt
    const endedAt = [...items].reverse().find(m => !!m.createdAt)?.createdAt ?? user?.createdAt

    if (interrupted) {
      return {
        user,
        interrupted,
        supporting: [],
        final: null,
        tail: [],
        startedAt,
        endedAt,
      }
    }

    let finalIdx = -1
    if (turnDone) {
      for (let i = items.length - 1; i >= 0; i--) {
        const m = items[i]
        if (m.role !== 'agent' || m.kind !== 'text' || m.phase !== 'final') continue
        if (m.streaming) continue
        finalIdx = i
        break
      }
    }

    const supporting: LiveMessage[] = []
    let final: LiveMessage | null = null
    const tail: LiveMessage[] = []
    items.forEach((m, i) => {
      if (i === finalIdx) final = m
      else supporting.push(m)
    })
    return { user, interrupted, supporting, final, tail, startedAt, endedAt }
  })
}

export function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function formatWorkedFor(startedAt?: string, endedAt?: string, nowMs?: number) {
  if (!startedAt) return null
  const startMs = Date.parse(startedAt)
  if (Number.isNaN(startMs)) return null
  const endMs = endedAt ? Date.parse(endedAt) : (nowMs ?? Date.now())
  if (Number.isNaN(endMs)) return null
  return formatWorkedForDuration(endMs - startMs)
}

export function formatWorkedForDuration(durationMs?: number | null) {
  if (durationMs == null) return null
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts =
    hours > 0
      ? [`${hours}h`, `${minutes}m`]
      : minutes > 0
        ? [`${minutes}m`, `${seconds}s`]
        : [`${seconds}s`]
  return `Worked for ${parts.join(' ')}`
}

export function getWorkedTimeDuration(turns: TurnGroup[], inFlight: boolean, nowMs = Date.now()) {
  return turns.reduce((total, turn, index) => {
    if (!turn.startedAt) return total
    const startMs = Date.parse(turn.startedAt)
    if (Number.isNaN(startMs)) return total

    const isLastTurn = index === turns.length - 1
    const endMs =
      inFlight && isLastTurn
        ? nowMs
        : turn.endedAt
          ? Date.parse(turn.endedAt)
          : startMs

    if (Number.isNaN(endMs)) return total
    return total + Math.max(0, endMs - startMs)
  }, 0)
}
