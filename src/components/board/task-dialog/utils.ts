import type { LiveMessage, TurnGroup } from './types'

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
    let finalIdx = -1
    if (turnDone) {
      for (let i = items.length - 1; i >= 0; i--) {
        const m = items[i]
        if (m.role !== 'agent' || m.kind !== 'text') continue
        if (m.streaming) continue
        finalIdx = i
        break
      }
    }

    const thinking: LiveMessage[] = []
    let final: LiveMessage | null = null
    items.forEach((m, i) => {
      if (i === finalIdx) final = m
      else thinking.push(m)
    })
    return { user, thinking, final }
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
