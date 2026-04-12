import { spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import readline from 'node:readline'
import { getDefaultModel, sanitizeFastMode, sanitizeModel } from '#domains/agents/agent-config.mjs'
import { sanitizeTaskType } from '#domains/agents/task-type-config.mjs'
import { CODEX_EFFORT, CODEX_MODEL, getAgentSystemPrompt } from './config.mjs'

/**
 * CodexClient: one instance per run. Spawns `codex app-server`, speaks JSON-RPC
 * line-delimited over stdio, and emits high-level events for the server to persist + stream.
 *
 * Events:
 *   'thread'        { threadId }
 *   'turnStarted'   { turnId }
 *   'agentDelta'    { itemId, delta }
 *   'item'          { item }                 // item/completed — authoritative
 *   'turnCompleted' { turn }
 *   'error'         { message }
 *   'exit'          { code, signal }
 */
export class CodexClient extends EventEmitter {
  constructor({ cwd, task, threadId = null }) {
    super()
    this.cwd = cwd
    this.taskMode = task?.mode ?? 'code'
    this.taskType = sanitizeTaskType(task?.task_type ?? task?.taskType)
    this.model = sanitizeModel('codex', task?.model) ?? getDefaultModel('codex') ?? CODEX_MODEL
    this.effort = task?.effort || CODEX_EFFORT
    this.fastMode = sanitizeFastMode(
      'codex',
      this.model,
      task?.fast_mode === true || task?.fast_mode === 1 || task?.fastMode === true
    )
    this.nextId = 1
    this.pending = new Map() // id -> { resolve, reject }
    this.threadId = threadId
    this.activeTurnId = null
    this.initialized = false
    this.proc = null
  }

  start() {
    this.proc = spawn('codex', ['app-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: this.cwd,
      env: process.env,
    })
    this.proc.on('error', e => this.emit('error', { message: `spawn failed: ${e.message}` }))
    this.proc.on('exit', (code, signal) => this.emit('exit', { code, signal }))
    this.proc.stderr.on('data', d => {
      // Surface stderr in logs but don't spam clients.
      process.stderr.write(`[codex ${this.cwd}] ${d}`)
    })

    const rl = readline.createInterface({ input: this.proc.stdout })
    rl.on('line', line => {
      if (!line.trim()) return
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        this.emit('error', { message: `bad json: ${line}` })
        return
      }
      this._handleMessage(msg)
    })
  }

  _send(obj) {
    this.proc.stdin.write(`${JSON.stringify(obj)}\n`)
  }

  _request(method, params) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this._send({ jsonrpc: '2.0', method, id, params })
    })
  }

  _notify(method, params) {
    this._send({ jsonrpc: '2.0', method, params })
  }

  _handleMessage(msg) {
    // Response to one of our requests
    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const p = this.pending.get(msg.id)
      if (p) {
        this.pending.delete(msg.id)
        if (msg.error) p.reject(new Error(msg.error.message || JSON.stringify(msg.error)))
        else p.resolve(msg.result)
        return
      }
    }

    // Server-initiated request (approvals, user input, etc.) — auto-decline for safety
    if (msg.id !== undefined && msg.method) {
      this._handleServerRequest(msg)
      return
    }

    // Notification
    if (msg.method) this._handleNotification(msg)
  }

  _handleServerRequest(msg) {
    // YOLO mode: auto-approve everything so the agent can execute without restrictions.
    let result = {}
    if (msg.method === 'item/commandExecution/requestApproval') result = { decision: 'approved' }
    else if (msg.method === 'item/fileChange/requestApproval') result = { decision: 'approved' }
    else if (msg.method === 'item/permissions/requestApproval') result = { decision: 'approved' }
    else if (msg.method === 'applyPatchApproval') result = { decision: 'approved' }
    else if (msg.method === 'execCommandApproval') result = { decision: 'approved' }
    this._send({ jsonrpc: '2.0', id: msg.id, result })
  }

  _handleNotification(msg) {
    switch (msg.method) {
      case 'thread/started':
        this.threadId = msg.params?.thread?.id ?? this.threadId
        this.emit('thread', { threadId: this.threadId })
        break
      case 'item/started':
        this.emit('itemStarted', { item: msg.params?.item })
        break
      case 'item/commandExecution/outputDelta':
        this.emit('commandDelta', {
          itemId: msg.params?.itemId,
          delta: msg.params?.delta ?? '',
        })
        break
      case 'turn/started':
        this.activeTurnId = msg.params?.turn?.id ?? null
        this.emit('turnStarted', { turnId: this.activeTurnId })
        break
      case 'item/agentMessage/delta':
        this.emit('agentDelta', {
          itemId: msg.params?.itemId,
          delta: msg.params?.delta ?? '',
        })
        break
      case 'item/completed':
        this.emit('item', { item: msg.params?.item })
        break
      case 'turn/completed':
        this.activeTurnId = null
        this.emit('turnCompleted', { turn: msg.params?.turn })
        break
      case 'error':
        this.emit('error', { message: msg.params?.message || 'codex error' })
        break
      default:
        // ignore other notifications
        break
    }
  }

  async initialize() {
    await this._request('initialize', {
      clientInfo: { name: 'agent-todo', title: 'Agent Todo', version: '0.1.0' },
      capabilities: { experimentalApi: false, optOutNotificationMethods: [] },
    })
    this._notify('initialized', {})
    this.initialized = true
  }

  async startThread() {
    if (this.threadId) {
      const res = await this._request('thread/resume', {
        threadId: this.threadId,
        cwd: this.cwd,
        model: this.model,
        ...(this.fastMode ? { serviceTier: 'fast' } : {}),
        approvalPolicy: 'never',
        sandbox: 'danger-full-access',
        experimentalRawEvents: false,
        persistExtendedHistory: false,
      })
      this.threadId = res?.thread?.id ?? this.threadId
      return this.threadId
    }
    const res = await this._request('thread/start', {
      model: this.model,
      cwd: this.cwd,
      ...(this.fastMode ? { serviceTier: 'fast' } : {}),
      approvalPolicy: 'never',
      sandbox: 'danger-full-access',
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    })
    this.threadId = res?.thread?.id ?? this.threadId
    return this.threadId
  }

  async sendUserText(text) {
    if (!this.threadId) throw new Error('thread not started')
    const systemPrompt = getAgentSystemPrompt({
      mode: this.taskMode,
      taskType: this.taskType,
    })
    const effectiveText = systemPrompt ? `${systemPrompt}\n\n---\n\n${text}` : text
    if (this.activeTurnId) {
      // Append to in-flight turn
      return this._request('turn/steer', {
        threadId: this.threadId,
        expectedTurnId: this.activeTurnId,
        input: [{ type: 'text', text: effectiveText, text_elements: [] }],
      })
    }
    return this._request('turn/start', {
      threadId: this.threadId,
      input: [{ type: 'text', text: effectiveText, text_elements: [] }],
      model: this.model,
      effort: this.effort,
      ...(this.fastMode ? { serviceTier: 'fast' } : {}),
    })
  }

  async interrupt() {
    if (!this.threadId || !this.activeTurnId) return
    try {
      await this._request('turn/interrupt', {
        threadId: this.threadId,
        turnId: this.activeTurnId,
      })
    } catch {}
  }

  stop() {
    try {
      this.proc?.kill('SIGTERM')
    } catch {}
  }
}
