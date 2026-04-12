/**
 * Run manager — orchestrates agent runs.
 *
 * Owns the in-memory `runs` Map and all event wiring between agent clients
 * and the SSE event buses. Has zero knowledge of HTTP.
 */

import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getAgentClass } from '../agents/agent-registry.mjs'
import { getTask } from '../tasks/task.repository.mjs'
import { appendMessage } from './message.repository.mjs'
import { createRun, getActiveRunForTask, getRun, updateRun } from './run.repository.mjs'

const SCRATCH_DIR = join(homedir(), '.agent-todo', 'scratch')

function resolveTaskCwd(project) {
  if (project && project !== 'untitled') return project
  mkdirSync(SCRATCH_DIR, { recursive: true })
  return SCRATCH_DIR
}

// In-memory registry of live runs keyed by runId
// { client: AgentClient, bus: EventEmitter, partials: Map<itemId,string>, ready: Promise<void> }
const runs = new Map()
const pendingBootstrap = new Map()
const taskLocks = new Map()
let resolveAgentClass = name => getAgentClass(name)
const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'interrupted'])
const INTERRUPT_GRACE_MS = 150

function isTerminalRunStatus(status) {
  return TERMINAL_RUN_STATUSES.has(status ?? '')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function closeLiveRun(runId, status) {
  const entry = runs.get(runId)
  if (!entry) return
  if (!entry.ended) {
    entry.ended = true
    entry.bus.emit('evt', { type: 'end', status })
  }
  runs.delete(runId)
}

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
 * Replace agent lookup at runtime (used by integration/e2e tests).
 */
export function setAgentClassResolver(resolver) {
  if (typeof resolver !== 'function') throw new Error('resolver must be a function')
  resolveAgentClass = resolver
}

/**
 * Reset custom resolver and clear live runs. Useful between test files.
 */
export function resetRunManagerState() {
  resolveAgentClass = name => getAgentClass(name)
  pendingBootstrap.clear()
  taskLocks.clear()
  for (const [, entry] of runs) {
    try {
      entry.client?.stop?.()
    } catch {
      // ignore cleanup failures
    }
  }
  runs.clear()
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
async function bootstrapRun(runId, task, client, bus, options = {}) {
  const sendBootstrapPrompt = options.sendBootstrapPrompt !== false
  // Build a richer first message so the agent always knows its working context,
  // even if the SDK's own cwd handling misbehaves.
  const modeLabel = task.mode === 'ask' ? '[ASK MODE — read-only analysis] ' : ''
  const hasProject = task.project && task.project !== 'untitled'
  const contextLine = hasProject
    ? `${modeLabel}Working directory: ${task.project}`
    : `${modeLabel}General research task — no specific project directory`
  const prompt = [contextLine, '', task.title].join('\n')
  try {
    client.start()
    await client.initialize()
    await client.startThread()
    if (sendBootstrapPrompt) {
      await client.sendUserText(prompt)
    }
  } catch (e) {
    const persisted = getRun(runId)
    if (persisted && persisted.status === 'interrupted') {
      try {
        client.stop()
      } catch {
        // ignore cancellation cleanup failures
      }
      return
    }
    const message = String(e.message || e)
    updateRun(runId, { status: 'failed' })
    const s = appendMessage(runId, 'system', 'error', message)
    bus.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'error',
      content: message,
      createdAt: new Date().toISOString(),
    })
    client.stop()
    closeLiveRun(runId, 'failed')
    throw e instanceof Error ? e : new Error(message)
  }
}

function attachLiveRun(run, task, options = {}) {
  const AgentClass = resolveAgentClass(task.agent)
  const cwd = resolveTaskCwd(task.project)
  const client = new AgentClass({ cwd, task, threadId: run.thread_id ?? null })
  const bus = new EventEmitter()
  bus.setMaxListeners(0)
  const partials = new Map()

  let resolveReady
  let rejectReady
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  ready.catch(() => {})

  runs.set(run.id, {
    client,
    bus,
    partials,
    ready,
    ended: false,
    terminalStatus: null,
    softInterrupting: false,
  })
  pendingBootstrap.set(run.id, ready)

  // ---- Wire agent events to persistence + SSE ----

  client.on('thread', ({ threadId }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    // Thread/turn lifecycle is internal plumbing — we track it in run status
    // but never surface it in the chat transcript (no persistence, no SSE).
    updateRun(run.id, { thread_id: threadId, status: 'running' })
  })

  client.on('turnStarted', ({ turnId }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    updateRun(run.id, { status: 'active' })
    bus.emit('evt', { type: 'turnStarted', turnId })
  })

  client.on('itemStarted', ({ item }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus || !item) return
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
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    bus.emit('evt', { type: 'commandDelta', itemId, delta })
  })

  client.on('agentDelta', ({ itemId, delta }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    const cur = partials.get(itemId) ?? ''
    partials.set(itemId, cur + delta)
    bus.emit('evt', { type: 'delta', itemId, delta })
  })

  client.on('item', ({ item }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus || !item) return
    if (item.type === 'agentMessage') {
      partials.delete(item.id)
      // Codex exposes a phase on agentMessage items: "commentary" (preamble /
      // thinking-aloud) vs "final_answer" (the actual reply). Older messages
      // may not carry a phase; we treat missing as "final" for back-compat.
      const phase = item.phase === 'commentary' ? 'commentary' : 'final'
      const s = appendMessage(run.id, 'agent', 'text', item.text ?? '', {
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
      const s = appendMessage(run.id, 'agent', 'text', text, {
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
      const s = appendMessage(run.id, 'system', 'command', line, {
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
    const live = runs.get(run.id)
    if (!live) return
    const turnStatus = turn?.status
    // Soft interrupt: user stopped the current turn but wants the run to stay
    // alive so they can send a follow-up. Land the run back in `idle` and keep
    // the live entry wired up.
    if (live.softInterrupting) {
      live.softInterrupting = false
      if (!live.terminalStatus) {
        updateRun(run.id, { status: 'idle' })
        bus.emit('evt', { type: 'turnCompleted', status: 'idle' })
      }
      return
    }
    if (turnStatus === 'interrupted') {
      live.terminalStatus = 'interrupted'
      updateRun(run.id, { status: 'interrupted' })
      bus.emit('evt', { type: 'turnCompleted', status: turnStatus })
      closeLiveRun(run.id, 'interrupted')
      return
    }
    if (live.terminalStatus) return
    updateRun(run.id, { status: 'idle' })
    bus.emit('evt', { type: 'turnCompleted', status: turn?.status })
  })

  client.on('error', ({ message }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    const s = appendMessage(run.id, 'system', 'error', message)
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
    const live = runs.get(run.id)
    const persisted = getRun(run.id)
    const status =
      live?.terminalStatus ??
      (isTerminalRunStatus(persisted?.status)
        ? persisted.status
        : live?.softInterrupting || persisted?.status === 'idle'
          ? 'idle'
          : code === 0
            ? 'completed'
            : 'failed')

    if (live?.softInterrupting) {
      live.softInterrupting = false
    }

    // Exit is plumbing — reflect it in run status, but don't pollute the chat.
    if (persisted && persisted.status !== status) {
      updateRun(run.id, { status })
    }
    closeLiveRun(run.id, status)
  })

  bootstrapRun(run.id, task, client, bus, options)
    .then(resolveReady)
    .catch(rejectReady)
    .finally(() => pendingBootstrap.delete(run.id))

  return run
}

export function startRun(task) {
  const runId = `r-${randomUUID().slice(0, 8)}`
  const run = createRun({
    id: runId,
    task_id: task.id,
    agent: task.agent,
    thread_id: null,
    status: 'starting',
    created_at: new Date().toISOString(),
  })

  // Persist the initial user instruction
  const seq = appendMessage(runId, 'user', 'text', task.title)
  const attached = attachLiveRun(run, task)
  emit(attached.id, {
    type: 'message',
    seq,
    role: 'user',
    kind: 'text',
    content: task.title,
    createdAt: new Date().toISOString(),
  })
  return attached
}

/**
 * Ensure a run exists for a task. Idempotent — returns existing run if one
 * is already active, otherwise starts a new one. Serialized per task to
 * prevent duplicate agent spawns from concurrent requests.
 */
export async function ensureRunForTask(task) {
  if (task.agent !== 'codex' && task.agent !== 'claude') return null

  // If another caller is already ensuring a run for this task, wait for it.
  if (taskLocks.has(task.id)) return taskLocks.get(task.id)

  const promise = (async () => {
    const existing = getActiveRunForTask(task.id)
    if (existing && runs.has(existing.id)) return existing
    if (existing) {
      const resumed = await ensureLiveRun(existing.id)
      if (runs.has(existing.id)) return resumed
      // row exists but process is gone and cannot be resumed — mark failed and start fresh
      updateRun(existing.id, { status: 'failed' })
    }
    const run = startRun(task)
    const ready = pendingBootstrap.get(run.id)
    if (ready) await ready
    return run
  })()

  taskLocks.set(task.id, promise)
  try {
    return await promise
  } finally {
    taskLocks.delete(task.id)
  }
}

export async function ensureLiveRun(runId) {
  const live = runs.get(runId)
  if (live) return getRun(runId)

  const persisted = getRun(runId)
  if (!persisted || isTerminalRunStatus(persisted.status)) return persisted

  const task = getTask(persisted.task_id)
  if (!task || (task.agent !== 'codex' && task.agent !== 'claude')) {
    return persisted
  }

  if (pendingBootstrap.has(runId)) {
    await pendingBootstrap.get(runId)
    return getRun(runId)
  }

  const run = attachLiveRun(persisted, task, { sendBootstrapPrompt: false })
  const ready = pendingBootstrap.get(run.id)
  if (ready) await ready
  return getRun(run.id)
}

/**
 * Soft-interrupt the current turn without tearing down the run. Lets the user
 * stop a turn in progress and immediately send a follow-up; the run stays live
 * and lands back in `idle` once the agent acknowledges the interrupt.
 */
export async function interruptRun(runId) {
  const persisted = getRun(runId)
  if (!persisted || isTerminalRunStatus(persisted.status)) return persisted
  const entry = runs.get(runId)
  if (!entry || entry.terminalStatus || entry.ended) return persisted

  entry.softInterrupting = true
  try {
    await Promise.race([Promise.resolve(entry.client.interrupt?.()), sleep(INTERRUPT_GRACE_MS)])
  } catch {
    // ignore interrupt errors — the agent may have already completed
  }
  return getRun(runId)
}

export async function stopRun(runId, status = 'interrupted') {
  const persisted = getRun(runId)
  if (!persisted || isTerminalRunStatus(persisted.status)) return persisted

  updateRun(runId, { status })

  const entry = runs.get(runId)
  if (!entry) return getRun(runId)

  if (entry.terminalStatus === status && entry.ended) {
    return getRun(runId)
  }

  entry.terminalStatus = status
  closeLiveRun(runId, status)

  try {
    await Promise.race([Promise.resolve(entry.client.interrupt?.()), sleep(INTERRUPT_GRACE_MS)])
  } catch {
    // ignore interrupt errors and fall back to hard stop below
  }

  try {
    entry.client.stop?.()
  } catch {
    // ignore hard-stop failures
  }

  return getRun(runId)
}

export async function stopRunForTask(taskId, status = 'interrupted') {
  const active = getActiveRunForTask(taskId)
  if (!active) return null
  return stopRun(active.id, status)
}
