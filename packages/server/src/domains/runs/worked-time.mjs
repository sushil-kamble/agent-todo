import { listMessages } from './message.repository.mjs'
import { getActiveRunForTask, getLatestRunForTask } from './run.repository.mjs'

const LIVE_RUN_STATUSES = new Set(['starting', 'running', 'active'])

function toTimestamp(value) {
  if (typeof value !== 'string' || value.length === 0) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

function measureTurnDuration(startedAt, endedAt) {
  const startMs = toTimestamp(startedAt)
  const endMs = toTimestamp(endedAt ?? startedAt)
  if (startMs == null || endMs == null) return 0
  return Math.max(0, endMs - startMs)
}

export function summarizeRunWorkedTime(run, messages) {
  if (!run) return null

  const turns = []
  let currentTurn = null

  for (const message of messages) {
    if (typeof message?.created_at !== 'string' || message.created_at.length === 0) continue

    if (message.role === 'user') {
      if (currentTurn) turns.push(currentTurn)
      currentTurn = {
        startedAt: message.created_at,
        endedAt: message.created_at,
      }
      continue
    }

    if (!currentTurn) {
      currentTurn = {
        startedAt: message.created_at,
        endedAt: message.created_at,
      }
      continue
    }

    currentTurn.endedAt = message.created_at
  }

  if (currentTurn) turns.push(currentTurn)

  if (turns.length === 0) {
    return {
      total_ms: 0,
      active_turn_started_at: LIVE_RUN_STATUSES.has(run.status ?? '')
        ? (run.created_at ?? null)
        : null,
    }
  }

  const isLive = LIVE_RUN_STATUSES.has(run.status ?? '')
  const lastTurnIndex = turns.length - 1
  let totalMs = 0

  turns.forEach((turn, index) => {
    if (isLive && index === lastTurnIndex) return
    totalMs += measureTurnDuration(turn.startedAt, turn.endedAt)
  })

  return {
    total_ms: totalMs,
    active_turn_started_at: isLive
      ? (turns[lastTurnIndex]?.startedAt ?? run.created_at ?? null)
      : null,
  }
}

export function getTaskWorkedTime(taskId) {
  const run = getActiveRunForTask(taskId) ?? getLatestRunForTask(taskId)
  if (!run) return null
  return summarizeRunWorkedTime(run, listMessages(run.id))
}
