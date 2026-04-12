import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { query } from '@anthropic-ai/claude-agent-sdk'
import { getDefaultModel, sanitizeModel } from '#domains/agents/agent-config.mjs'
import { ASK_MODE_PROMPT, CLAUDE_EFFORT, CLAUDE_MODEL } from './config.mjs'

/**
 * ClaudeClient: one instance per run. Wraps `@anthropic-ai/claude-agent-sdk`
 * `query()` and maps the SDK message stream onto the same EventEmitter
 * interface as `CodexClient`, so the run-manager can treat both the same way.
 *
 * Events (must match CodexClient):
 *   'thread'        { threadId }
 *   'turnStarted'   { turnId }
 *   'itemStarted'   { item }          // item: { type, id, command?, cwd?, phase? }
 *   'agentDelta'    { itemId, delta } // streaming assistant text
 *   'commandDelta'  { itemId, delta } // streaming tool/command output
 *   'item'          { item }          // completed item (agentMessage | reasoning | commandExecution)
 *   'turnCompleted' { turn }          // { status }
 *   'error'         { message }
 *   'exit'          { code, signal }
 */
export class ClaudeClient extends EventEmitter {
  constructor({ cwd, task, threadId = null }) {
    super()
    this.cwd = cwd
    this.taskMode = task?.mode ?? 'code'
    this.taskModel =
      sanitizeModel('claude', task?.model) ?? getDefaultModel('claude') ?? CLAUDE_MODEL
    this.taskEffort = task?.effort || CLAUDE_EFFORT
    this.promptQueue = new PromptQueue()
    this.query = null
    this.stopped = false
    this.errored = false
    this.threadId = threadId

    // Per-assistant-message block tracking (keyed by stream event index).
    // { type: 'text' | 'thinking' | 'tool_use', itemId, buffer }
    this.blocks = new Map()

    // Tool calls in flight, keyed by Claude's tool_use_id.
    // { itemId, itemType, toolName, command, cwd, output }
    this.toolsById = new Map()

    // Synthetic turn id for the current in-flight turn.
    this.activeTurnId = null
  }

  start() {
    const isAskMode = this.taskMode === 'ask'
    try {
      this.query = query({
        prompt: this.promptQueue,
        options: {
          cwd: this.cwd,
          model: this.taskModel,
          effort: this.taskEffort,
          ...(this.threadId ? { resume: this.threadId } : {}),
          permissionMode: isAskMode ? 'default' : 'bypassPermissions',
          allowDangerouslySkipPermissions: !isAskMode,
          includePartialMessages: true,
          env: process.env,
          settingSources: ['user', 'project', 'local'],
          ...(isAskMode ? { systemPrompt: ASK_MODE_PROMPT } : {}),
          // Disable sandboxing so tools can access the host filesystem at the
          // project's cwd. Without this, user/project settings picked up via
          // settingSources can enable the sandbox, which containerises tool
          // execution and causes "No such file or directory" errors.
          sandbox: { enabled: false },
          stderr: data => process.stderr.write(`[claude ${this.cwd}] ${data}`),
        },
      })
    } catch (e) {
      this.errored = true
      this.emit('error', { message: `claude query init failed: ${e?.message || e}` })
      this.emit('exit', { code: 1, signal: null })
      return
    }
    // Drive the SDK stream in the background.
    this._streamLoop().catch(e => {
      if (this.stopped) return
      this.errored = true
      this.emit('error', { message: String(e?.message || e) })
      this.emit('exit', { code: 1, signal: null })
    })
  }

  async initialize() {
    // claude-agent-sdk has no separate init step — query() handles it.
  }

  async startThread() {
    // Thread id is assigned by the SDK once the first `system/init` message
    // arrives; we surface it via the 'thread' event then.
    return this.threadId
  }

  async sendUserText(text) {
    if (this.stopped) throw new Error('claude session closed')
    // Every user message conceptually starts a new turn. The SDK queues it and
    // begins processing when it's idle.
    const turnId = randomUUID()
    this.activeTurnId = turnId
    this.emit('turnStarted', { turnId })
    this.promptQueue.push({
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text }],
      },
      parent_tool_use_id: null,
      session_id: this.threadId ?? '',
    })
  }

  async interrupt() {
    if (!this.query) return
    try {
      await this.query.interrupt()
    } catch {}
  }

  stop() {
    if (this.stopped) return
    this.stopped = true
    try {
      this.promptQueue.close()
    } catch {}
    try {
      this.query?.close()
    } catch {}
  }

  async _streamLoop() {
    try {
      for await (const message of this.query) {
        if (this.stopped) break
        try {
          this._handleSdkMessage(message)
        } catch (e) {
          process.stderr.write(`[claude ${this.cwd}] handler error: ${e?.stack || e}\n`)
          this.emit('error', { message: `handler: ${e?.message || e}` })
        }
      }
    } catch (e) {
      if (!this.stopped) {
        this.errored = true
        this.emit('error', { message: String(e?.message || e) })
      }
    }
    this.emit('exit', { code: this.errored ? 1 : 0, signal: null })
    this.stopped = true
  }

  _handleSdkMessage(msg) {
    if (!msg || typeof msg !== 'object') return

    if (typeof msg.session_id === 'string' && msg.session_id.length > 0 && !this.threadId) {
      this.threadId = msg.session_id
      this.emit('thread', { threadId: this.threadId })
    }

    switch (msg.type) {
      case 'system':
        return
      case 'stream_event':
        return this._handleStreamEvent(msg)
      case 'assistant':
        return this._handleAssistantMessage(msg)
      case 'user':
        return this._handleUserMessage(msg)
      case 'result':
        return this._handleResultMessage(msg)
      default:
        return
    }
  }

  _handleStreamEvent(msg) {
    const event = msg.event
    if (!event || typeof event !== 'object') return
    const type = event.type

    if (type === 'message_start') {
      // A new assistant message begins — reset per-message block tracking.
      this.blocks.clear()
      return
    }

    if (type === 'content_block_start') {
      const block = event.content_block
      if (!block || typeof block !== 'object') return
      const index = event.index
      if (block.type === 'text') {
        const itemId = randomUUID()
        this.blocks.set(index, { type: 'text', itemId, buffer: '' })
        this.emit('itemStarted', {
          item: { type: 'agentMessage', id: itemId, phase: 'final' },
        })
      } else if (block.type === 'thinking') {
        const itemId = randomUUID()
        this.blocks.set(index, { type: 'thinking', itemId, buffer: '' })
      }
      // tool_use blocks are finalized from the `assistant` message where the
      // full input is available, so we don't need per-block tracking here.
      return
    }

    if (type === 'content_block_delta') {
      const index = event.index
      const block = this.blocks.get(index)
      if (!block) return
      const delta = event.delta
      if (!delta || typeof delta !== 'object') return
      if (delta.type === 'text_delta' && typeof delta.text === 'string') {
        if (delta.text.length === 0) return
        block.buffer += delta.text
        this.emit('agentDelta', { itemId: block.itemId, delta: delta.text })
      } else if (delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
        block.buffer += delta.thinking
      }
      return
    }

    if (type === 'content_block_stop') {
      const index = event.index
      const block = this.blocks.get(index)
      if (!block) return
      if (block.type === 'text') {
        this.emit('item', {
          item: {
            type: 'agentMessage',
            id: block.itemId,
            text: block.buffer,
            phase: 'final',
          },
        })
      } else if (block.type === 'thinking') {
        const text = block.buffer.trim()
        if (text.length > 0) {
          this.emit('item', {
            item: {
              type: 'reasoning',
              id: block.itemId,
              content: text,
            },
          })
        }
      }
      this.blocks.delete(index)
      return
    }
  }

  _handleAssistantMessage(msg) {
    const content = msg?.message?.content
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      if (
        block.type !== 'tool_use' &&
        block.type !== 'server_tool_use' &&
        block.type !== 'mcp_tool_use'
      )
        continue
      const toolUseId =
        typeof block.id === 'string' && block.id.length > 0 ? block.id : randomUUID()
      if (this.toolsById.has(toolUseId)) continue
      const toolName = typeof block.name === 'string' ? block.name : 'tool'
      const input = block.input && typeof block.input === 'object' ? block.input : {}
      const command = summarizeToolInput(toolName, input)
      const cwd = typeof input.cwd === 'string' && input.cwd.length > 0 ? input.cwd : this.cwd
      const info = {
        itemId: toolUseId,
        itemType: 'commandExecution',
        toolName,
        command,
        cwd,
        output: '',
      }
      this.toolsById.set(toolUseId, info)
      this.emit('itemStarted', {
        item: {
          type: 'commandExecution',
          id: toolUseId,
          command,
          cwd,
        },
      })
    }
  }

  _handleUserMessage(msg) {
    const content = msg?.message?.content
    if (!Array.isArray(content)) return
    for (const block of content) {
      if (!block || typeof block !== 'object') continue
      if (block.type !== 'tool_result') continue
      const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : null
      if (!toolUseId) continue
      const info = this.toolsById.get(toolUseId)
      if (!info) continue
      const text = extractToolResultText(block.content)
      if (text.length > 0) {
        this.emit('commandDelta', { itemId: info.itemId, delta: text })
        info.output += text
      }
      const isError = block.is_error === true
      this.emit('item', {
        item: {
          type: 'commandExecution',
          id: info.itemId,
          command: info.command,
          cwd: info.cwd,
          status: isError ? 'failed' : 'completed',
          exitCode: isError ? 1 : 0,
        },
      })
      this.toolsById.delete(toolUseId)
    }
  }

  _handleResultMessage(msg) {
    // Any tools still in flight at turn-end are force-closed.
    for (const [id, info] of this.toolsById) {
      this.emit('item', {
        item: {
          type: 'commandExecution',
          id: info.itemId,
          command: info.command,
          cwd: info.cwd,
          status: 'completed',
          exitCode: null,
        },
      })
      this.toolsById.delete(id)
    }
    this.blocks.clear()
    const status = msg?.subtype === 'success' ? 'completed' : 'failed'
    if (status === 'failed' && Array.isArray(msg.errors) && msg.errors[0]) {
      this.emit('error', { message: String(msg.errors[0]) })
    }
    this.emit('turnCompleted', { turn: { status } })
    this.activeTurnId = null
  }
}

/**
 * Minimal async-iterable queue used as the `prompt` input to `query()`.
 * The SDK pulls one SDKUserMessage at a time via `for await`, blocking on
 * `next()` when empty. Follow-up user messages are pushed in from the
 * run-manager via `client.sendUserText()`.
 */
class PromptQueue {
  constructor() {
    this.buffered = []
    this.waiters = []
    this.done = false
  }

  push(msg) {
    if (this.done) return
    if (this.waiters.length > 0) {
      const resolve = this.waiters.shift()
      resolve({ value: msg, done: false })
    } else {
      this.buffered.push(msg)
    }
  }

  close() {
    if (this.done) return
    this.done = true
    while (this.waiters.length > 0) {
      const resolve = this.waiters.shift()
      resolve({ value: undefined, done: true })
    }
  }

  [Symbol.asyncIterator]() {
    const self = this
    return {
      next() {
        if (self.buffered.length > 0) {
          return Promise.resolve({ value: self.buffered.shift(), done: false })
        }
        if (self.done) {
          return Promise.resolve({ value: undefined, done: true })
        }
        return new Promise(resolve => self.waiters.push(resolve))
      },
      return() {
        self.close()
        return Promise.resolve({ value: undefined, done: true })
      },
    }
  }
}

/**
 * Turn a tool-use invocation into a short human-readable "command" line so
 * it can be displayed in the chat panel where Codex commands show up.
 */
function summarizeToolInput(toolName, input) {
  if (!input || typeof input !== 'object') return toolName
  const lower = toolName.toLowerCase()

  // Shell-like tools: show the actual command.
  if (lower === 'bash' || lower.includes('shell') || lower.includes('terminal')) {
    const cmd = input.command ?? input.cmd
    if (typeof cmd === 'string' && cmd.trim().length > 0) return cmd.trim()
  }

  // File tools: show "Tool path".
  const file = input.file_path ?? input.path ?? input.filename ?? input.notebook_path
  if (typeof file === 'string' && file.trim().length > 0) {
    return `${toolName} ${file.trim()}`
  }

  // Search tools: show "Tool \"query\"".
  const q = input.query ?? input.pattern
  if (typeof q === 'string' && q.trim().length > 0) {
    return `${toolName} ${JSON.stringify(q.trim().slice(0, 80))}`
  }

  // URL-fetching tools.
  if (typeof input.url === 'string' && input.url.length > 0) {
    return `${toolName} ${input.url}`
  }

  // Fallback: compact JSON summary.
  try {
    const j = JSON.stringify(input)
    return `${toolName} ${j.length > 200 ? `${j.slice(0, 197)}...` : j}`
  } catch {
    return toolName
  }
}

/**
 * Extract plain text from the `content` field of a tool_result block. Claude
 * tool results can be a string, an array of content blocks, or a nested
 * object — we flatten to a string so we can stream it as commandDelta.
 */
function extractToolResultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content.map(extractToolResultText).filter(Boolean).join('')
  }
  if (content && typeof content === 'object') {
    if (typeof content.text === 'string') return content.text
    if (content.content !== undefined) return extractToolResultText(content.content)
  }
  return ''
}
