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
import { appendMessage, listMessages } from './message.repository.mjs'
import {
  createRun,
  getActiveRunForTask,
  getLatestRunForTask,
  getRun,
  updateRun,
} from './run.repository.mjs'

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
const EXECUTING_RUN_STATUSES = new Set(['starting', 'running', 'active'])
const PRESERVED_RUN_STATUSES = new Set(['idle', 'paused'])
const INTERRUPT_GRACE_MS = 150
const CONTINUE_PAUSED_TURN_PROMPT = [
  'Continue the previous unfinished request from this thread.',
  'The task card temporarily left in-progress before you finished responding.',
  'Resume from the existing context instead of restarting from the original task title, and continue from any partial work already completed.',
].join('\n')

function isTerminalRunStatus(status) {
  return TERMINAL_RUN_STATUSES.has(status ?? '')
}

function isExecutingRunStatus(status) {
  return EXECUTING_RUN_STATUSES.has(status ?? '')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function setRunDispatching(runId, dispatching) {
  const live = runs.get(runId)
  if (!live) return
  live.dispatching = dispatching
}

function buildBootstrapPrompt(task) {
  const hasProject = task.project && task.project !== 'untitled'
  const contextLine = hasProject
    ? `Working directory: ${task.project}`
    : 'General research task — no specific project directory'
  return [contextLine, '', task.title].join('\n')
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
  const prompt = buildBootstrapPrompt(task)
  try {
    client.start()
    await client.initialize()
    await client.startThread()
    if (sendBootstrapPrompt) {
      setRunDispatching(runId, true)
      try {
        await client.sendUserText(prompt)
      } finally {
        setRunDispatching(runId, false)
      }
    }
  } catch (e) {
    setRunDispatching(runId, false)
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
  const sendBootstrapPrompt = options.sendBootstrapPrompt !== false
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
    dispatching: false,
  })
  pendingBootstrap.set(run.id, ready)

  // ---- Wire agent events to persistence + SSE ----

  client.on('thread', ({ threadId }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    // Thread/turn lifecycle is internal plumbing — we track it in run status
    // but never surface it in the chat transcript (no persistence, no SSE).
    if (sendBootstrapPrompt) {
      updateRun(run.id, { thread_id: threadId, status: 'running' })
      return
    }
    updateRun(run.id, { thread_id: threadId })
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
      provider: item.type === 'reasoning' ? item.provider : undefined,
      reasoningFormat: item.type === 'reasoning' ? item.reasoningFormat : undefined,
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
    bus.emit('evt', { type: 'delta', itemId, kind: 'text', delta })
  })

  client.on('reasoningDelta', ({ itemId, delta, provider, reasoningFormat }) => {
    const live = runs.get(run.id)
    if (!live || live.terminalStatus) return
    const cur = partials.get(itemId) ?? ''
    partials.set(itemId, cur + delta)
    bus.emit('evt', {
      type: 'delta',
      itemId,
      kind: 'reasoning',
      delta,
      provider,
      reasoningFormat,
    })
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
      const streamed = partials.get(item.id) ?? ''
      partials.delete(item.id)
      const text = extractReasoningText(item) || streamed.trim()
      if (!text) return
      const s = appendMessage(run.id, 'agent', 'reasoning', text, {
        itemId: item.id,
        provider: item.provider,
        reasoningFormat: item.reasoningFormat,
      })
      bus.emit('evt', {
        type: 'message',
        seq: s,
        role: 'agent',
        kind: 'reasoning',
        content: text,
        itemId: item.id,
        provider: item.provider,
        reasoningFormat: item.reasoningFormat,
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
        : live?.softInterrupting
          ? 'idle'
          : PRESERVED_RUN_STATUSES.has(persisted?.status ?? '')
            ? persisted.status
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
    const existing = getActiveRunForTask(task.id) ?? getRunForTaskHistory(task.id)
    if (existing && runs.has(existing.id)) return existing
    if (existing) {
      const run = await ensureLiveRun(existing.id, {
        reviveTerminal: true,
        status: 'idle',
      })
      if (existing.status === 'paused') {
        await resumePausedRun(existing.id, task)
      }
      return run
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

function getRunForTaskHistory(taskId) {
  const active = getActiveRunForTask(taskId)
  if (active) return active
  return getLatestRunForTask(taskId)
}

export async function ensureLiveRun(runId, options = {}) {
  const reviveTerminal = options.reviveTerminal === true
  const targetStatus = typeof options.status === 'string' ? options.status : null

  const live = runs.get(runId)
  if (live) {
    if (targetStatus) updateRun(runId, { status: targetStatus })
    return getRun(runId)
  }

  let persisted = getRun(runId)
  if (!persisted) return persisted
  if (targetStatus && persisted.status !== targetStatus) {
    updateRun(runId, { status: targetStatus })
    persisted = getRun(runId)
  }
  if (!persisted || (!reviveTerminal && isTerminalRunStatus(persisted.status))) return persisted

  const task = getTask(persisted.task_id)
  if (!task || (task.agent !== 'codex' && task.agent !== 'claude')) {
    return persisted
  }

  if (pendingBootstrap.has(runId)) {
    await pendingBootstrap.get(runId)
    if (runs.has(runId)) return getRun(runId)
    persisted = getRun(runId)
    if (!persisted) return persisted
    if (targetStatus && persisted.status !== targetStatus) {
      updateRun(runId, { status: targetStatus })
      persisted = getRun(runId)
    }
    if (!persisted || (!reviveTerminal && isTerminalRunStatus(persisted.status))) return persisted
  }

  const run = attachLiveRun(persisted, task, { sendBootstrapPrompt: false })
  const ready = pendingBootstrap.get(run.id)
  if (ready) await ready
  return getRun(run.id)
}

export async function dispatchRunInput(runId, text) {
  const entry = runs.get(runId)
  if (!entry) throw new Error('run not active')

  setRunDispatching(runId, true)
  try {
    await entry.ready
    await entry.client.sendUserText(text)
  } finally {
    setRunDispatching(runId, false)
  }
  return getRun(runId)
}

function getPausedResumeRequest(runId, task) {
  const messages = listMessages(runId).filter(message => message.kind !== 'status')
  const firstUser = messages.find(message => message.role === 'user') ?? null
  let lastUser = null
  let hasActivityAfterLastUser = false

  for (const message of messages) {
    if (message.role === 'user') {
      lastUser = message
      hasActivityAfterLastUser = false
      continue
    }
    if (lastUser) {
      hasActivityAfterLastUser = true
    }
  }

  if (!lastUser) {
    return {
      text: buildBootstrapPrompt(task),
      mode: 'bootstrap',
      lastUserSeq: null,
    }
  }

  const shouldReplayBootstrap =
    lastUser.seq === firstUser?.seq &&
    lastUser.content === task.title &&
    hasActivityAfterLastUser === false

  if (shouldReplayBootstrap) {
    return {
      text: buildBootstrapPrompt(task),
      mode: 'bootstrap',
      lastUserSeq: lastUser.seq,
    }
  }

  if (!hasActivityAfterLastUser) {
    return {
      text: lastUser.content,
      mode: 'replay-last-user',
      lastUserSeq: lastUser.seq,
    }
  }

  return {
    text: CONTINUE_PAUSED_TURN_PROMPT,
    mode: 'continue',
    lastUserSeq: lastUser.seq,
  }
}

async function resumePausedRun(runId, task) {
  if (!runs.has(runId)) return getRun(runId)

  const resumeRequest = getPausedResumeRequest(runId, task)
  const createdAt = new Date().toISOString()
  const seq = appendMessage(runId, 'system', 'status', `auto-resume:${resumeRequest.mode}`, {
    resumedFromPaused: true,
    resumeMode: resumeRequest.mode,
    lastUserSeq: resumeRequest.lastUserSeq,
  })
  emit(runId, {
    type: 'message',
    seq,
    role: 'system',
    kind: 'status',
    content: `auto-resume:${resumeRequest.mode}`,
    createdAt,
  })

  await dispatchRunInput(runId, resumeRequest.text)
  return getRun(runId)
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

export async function preserveRunForTask(taskId) {
  const run = getActiveRunForTask(taskId)
  if (!run) return null
  const live = runs.get(run.id)
  const nextStatus =
    isExecutingRunStatus(run.status) || live?.dispatching === true ? 'paused' : 'idle'
  return stopRun(run.id, nextStatus)
}
