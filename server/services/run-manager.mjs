/**
 * Run manager — orchestrates agent runs.
 *
 * Owns the in-memory `runs` Map and all event wiring between agent clients
 * and the SSE event buses. Has zero knowledge of HTTP.
 */
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import { createRun, getActiveRunForTask, updateRun } from '../db/runs.mjs'
import { appendMessage } from '../db/messages.mjs'
import { getAgentClass } from '../agents/index.mjs'

// In-memory registry of live runs keyed by runId
// { client: AgentClient, bus: EventEmitter, partials: Map<itemId,string> }
const runs = new Map()

function extractReasoningText(item) {
  const chunks = []
  const visit = value => {
    if (!value) return
    if (typeof value === 'string') {
      const text = value.trim()
      if (text) chunks.push(text)
      return
    }
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry)
      return
    }
    if (typeof value === 'object') {
      // Keep extraction narrow so we don't accidentally surface ids/types.
      if ('text' in value) visit(value.text)
      if ('summary' in value) visit(value.summary)
      if ('content' in value) visit(value.content)
      if ('value' in value) visit(value.value)
    }
  }
  visit(item?.summary)
  visit(item?.content)
  return chunks.join('\n\n')
}

/**
 * Get a live run entry by runId.
 * Returns { client, bus, partials } or undefined.
 */
export function getLiveRun(runId) {
  return runs.get(runId)
}

/**
 * Broadcast an event to all SSE subscribers of a run.
 */
export function emit(runId, event) {
  const entry = runs.get(runId)
  if (entry) entry.bus.emit('evt', event)
}

/**
 * Start a new agent run for a task.
 * Creates the DB row, spawns the agent process, wires all events.
 */
export async function startRun(task) {
  const runId = `r-${randomUUID().slice(0, 8)}`
  const run = createRun({
    id: runId,
    task_id: task.id,
    agent: task.agent,
    thread_id: null,
    status: 'starting',
    created_at: new Date().toISOString(),
  })

  const AgentClass = getAgentClass(task.agent)
  const client = new AgentClass({ cwd: task.project })
  const bus = new EventEmitter()
  bus.setMaxListeners(0)
  const partials = new Map()
  runs.set(runId, { client, bus, partials })

  // Persist the initial user instruction
  const seq = appendMessage(runId, 'user', 'text', task.title)
  bus.emit('evt', {
    type: 'message',
    seq,
    role: 'user',
    kind: 'text',
    content: task.title,
    createdAt: new Date().toISOString(),
  })

  // ---- Wire agent events to persistence + SSE ----

  client.on('thread', ({ threadId }) => {
    // Thread/turn lifecycle is internal plumbing — we track it in run status
    // but never surface it in the chat transcript (no persistence, no SSE).
    updateRun(runId, { thread_id: threadId, status: 'running' })
  })

  client.on('turnStarted', ({ turnId }) => {
    updateRun(runId, { status: 'active' })
    bus.emit('evt', { type: 'turnStarted', turnId })
  })

  client.on('itemStarted', ({ item }) => {
    if (!item) return
    const phase =
      item.type === 'agentMessage'
        ? item.phase === 'commentary'
          ? 'commentary'
          : 'final'
        : undefined
    bus.emit('evt', {
      type: 'itemStarted',
      itemType: item.type,
      itemId: item.id,
      command: item.type === 'commandExecution' ? item.command : undefined,
      cwd: item.type === 'commandExecution' ? item.cwd : undefined,
      phase,
    })
  })

  client.on('commandDelta', ({ itemId, delta }) => {
    bus.emit('evt', { type: 'commandDelta', itemId, delta })
  })

  client.on('agentDelta', ({ itemId, delta }) => {
    const cur = partials.get(itemId) ?? ''
    partials.set(itemId, cur + delta)
    bus.emit('evt', { type: 'delta', itemId, delta })
  })

  client.on('item', ({ item }) => {
    if (!item) return
    if (item.type === 'agentMessage') {
      partials.delete(item.id)
      // Codex exposes a phase on agentMessage items: "commentary" (preamble /
      // thinking-aloud) vs "final_answer" (the actual reply). Older messages
      // may not carry a phase; we treat missing as "final" for back-compat.
      const phase = item.phase === 'commentary' ? 'commentary' : 'final'
      const s = appendMessage(runId, 'agent', 'text', item.text ?? '', {
        itemId: item.id,
        phase,
      })
      bus.emit('evt', {
        type: 'message',
        seq: s,
        role: 'agent',
        kind: 'text',
        content: item.text ?? '',
        phase,
        itemId: item.id,
        createdAt: new Date().toISOString(),
      })
    } else if (item.type === 'reasoning') {
      const text = extractReasoningText(item)
      if (!text) return
      const s = appendMessage(runId, 'agent', 'text', text, {
        phase: 'commentary',
        source: 'reasoning',
        itemId: item.id,
      })
      bus.emit('evt', {
        type: 'message',
        seq: s,
        role: 'agent',
        kind: 'text',
        content: text,
        phase: 'commentary',
        itemId: item.id,
        source: 'reasoning',
        createdAt: new Date().toISOString(),
      })
    } else if (item.type === 'commandExecution') {
      const line = `$ ${item.command}${item.exitCode != null ? ` (exit ${item.exitCode})` : ''}`
      const s = appendMessage(runId, 'system', 'command', line, {
        itemId: item.id,
        cwd: item.cwd,
        status: item.status,
        exitCode: item.exitCode,
      })
      bus.emit('evt', {
        type: 'message',
        seq: s,
        role: 'system',
        kind: 'command',
        content: line,
        createdAt: new Date().toISOString(),
      })
    }
  })

  client.on('turnCompleted', ({ turn }) => {
    updateRun(runId, { status: 'idle' })
    bus.emit('evt', { type: 'turnCompleted', status: turn?.status })
  })

  client.on('error', ({ message }) => {
    const s = appendMessage(runId, 'system', 'error', message)
    bus.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'error',
      content: message,
      createdAt: new Date().toISOString(),
    })
  })

  client.on('exit', ({ code }) => {
    // Exit is plumbing — reflect it in run status, but don't pollute the chat.
    updateRun(runId, { status: code === 0 ? 'completed' : 'failed' })
    bus.emit('evt', { type: 'end' })
    runs.delete(runId)
  })

  // ---- Start the agent ----

  try {
    client.start()
    await client.initialize()
    await client.startThread()
    await client.sendUserText(task.title)
  } catch (e) {
    updateRun(runId, { status: 'failed' })
    const s = appendMessage(runId, 'system', 'error', String(e.message || e))
    bus.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'error',
      content: String(e.message || e),
      createdAt: new Date().toISOString(),
    })
    client.stop()
    runs.delete(runId)
    throw e
  }

  return run
}

/**
 * Ensure a run exists for a task. Idempotent — returns existing run if one
 * is already active, otherwise starts a new one.
 */
export async function ensureRunForTask(task) {
  if (task.agent !== 'codex' && task.agent !== 'claude') return null
  const existing = getActiveRunForTask(task.id)
  if (existing && runs.has(existing.id)) return existing
  if (existing) {
    // row exists but process is gone — mark failed and start fresh
    updateRun(existing.id, { status: 'failed' })
  }
  return startRun(task)
}
