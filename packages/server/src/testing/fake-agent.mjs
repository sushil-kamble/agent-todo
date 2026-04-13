import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'

const DEFAULT_TURN_STATUS = 'completed'

let queuedScripts = []
let scriptsByTaskId = new Map()
let defaultScriptFactory = () => createFakeRunScript()
const sendLog = []

function cloneStep(step) {
  if (!step || typeof step !== 'object') return step
  if (Array.isArray(step)) return step.map(cloneStep)
  return {
    ...step,
    item: step.item ? cloneStep(step.item) : step.item,
    outputDeltas: Array.isArray(step.outputDeltas) ? [...step.outputDeltas] : step.outputDeltas,
  }
}

function cloneScript(script) {
  if (!script || typeof script !== 'object') return createFakeRunScript()
  return {
    ...script,
    turns: Array.isArray(script.turns) ? script.turns.map(turn => turn.map(cloneStep)) : [],
    sendErrors: Array.isArray(script.sendErrors) ? [...script.sendErrors] : [],
  }
}

function createId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8)}`
}

function selectScript(taskId) {
  if (taskId && scriptsByTaskId.has(taskId)) {
    const configured = scriptsByTaskId.get(taskId)
    if (Array.isArray(configured)) {
      if (configured.length > 1) {
        const next = configured.shift()
        scriptsByTaskId.set(taskId, configured)
        return cloneScript(next)
      }
      return cloneScript(configured[0])
    }
    return cloneScript(configured)
  }

  if (queuedScripts.length > 0) {
    return cloneScript(queuedScripts.shift())
  }

  return cloneScript(defaultScriptFactory(taskId))
}

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0))
  })
}

async function playStep(client, step) {
  if (!step || typeof step !== 'object') return

  switch (step.type) {
    case 'delay': {
      let remaining = Math.max(0, Number(step.ms) || 0)
      while (remaining > 0) {
        if (client.interruptRequested) return
        const slice = Math.min(remaining, 25)
        await sleep(slice)
        remaining -= slice
      }
      return
    }

    case 'thread': {
      const threadId = step.threadId || client.threadId
      client.threadId = threadId
      client.emit('thread', { threadId })
      return
    }

    case 'turnStarted': {
      client.emit('turnStarted', { turnId: step.turnId || createId('turn') })
      return
    }

    case 'itemStarted': {
      if (step.item) client.emit('itemStarted', { item: step.item })
      return
    }

    case 'delta': {
      client.emit('agentDelta', {
        itemId: step.itemId || createId('msg'),
        delta: step.delta ?? '',
      })
      return
    }

    case 'reasoningDelta': {
      client.emit('reasoningDelta', {
        itemId: step.itemId || createId('reasoning'),
        delta: step.delta ?? '',
        provider: step.provider || 'codex',
        reasoningFormat: step.reasoningFormat || 'summary',
      })
      return
    }

    case 'commandDelta': {
      client.emit('commandDelta', {
        itemId: step.itemId || createId('cmd'),
        delta: step.delta ?? '',
      })
      return
    }

    case 'agentMessage': {
      const itemId = step.itemId || createId('agent')
      const phase = step.phase === 'commentary' ? 'commentary' : 'final'
      const text = step.text ?? step.delta ?? ''
      if (step.emitItemStarted !== false) {
        client.emit('itemStarted', {
          item: { type: 'agentMessage', id: itemId, phase },
        })
      }
      if (step.delta) {
        client.emit('agentDelta', { itemId, delta: step.delta })
      }
      client.emit('item', {
        item: { type: 'agentMessage', id: itemId, text, phase },
      })
      return
    }

    case 'reasoning': {
      const itemId = step.itemId || createId('reasoning')
      const text = step.text ?? step.content ?? ''
      const provider = step.provider || 'codex'
      const reasoningFormat = step.reasoningFormat || 'summary'
      if (step.emitItemStarted !== false) {
        client.emit('itemStarted', {
          item: {
            type: 'reasoning',
            id: itemId,
            provider,
            reasoningFormat,
          },
        })
      }
      if (Array.isArray(step.outputDeltas)) {
        for (const delta of step.outputDeltas) {
          client.emit('reasoningDelta', {
            itemId,
            delta,
            provider,
            reasoningFormat,
          })
        }
      }
      client.emit('item', {
        item: {
          type: 'reasoning',
          id: itemId,
          content: text,
          provider,
          reasoningFormat,
        },
      })
      return
    }

    case 'command': {
      const itemId = step.itemId || createId('cmd')
      const command = step.command || 'echo ok'
      const cwd = step.cwd || client.cwd
      const status = step.status || 'completed'
      const outputDeltas = Array.isArray(step.outputDeltas) ? step.outputDeltas : []
      if (step.emitItemStarted !== false) {
        client.emit('itemStarted', {
          item: {
            type: 'commandExecution',
            id: itemId,
            command,
            cwd,
          },
        })
      }
      for (const delta of outputDeltas) {
        client.emit('commandDelta', { itemId, delta })
      }
      client.emit('item', {
        item: {
          type: 'commandExecution',
          id: itemId,
          command,
          cwd,
          status,
          exitCode: step.exitCode ?? (status === 'completed' ? 0 : 1),
        },
      })
      return
    }

    case 'turnCompleted': {
      client.emit('turnCompleted', {
        turn: { status: step.status || DEFAULT_TURN_STATUS },
      })
      return
    }

    case 'error': {
      client.emit('error', { message: step.message || 'fake agent error' })
      return
    }

    case 'exit': {
      client.emit('exit', { code: step.code ?? 0, signal: null })
      return
    }

    case 'throw': {
      throw new Error(step.message || 'fake agent throw')
    }

    default:
      return
  }
}

async function playTurn(client, steps) {
  for (const step of steps) {
    if (client.stopped || client.interruptRequested) return
    await playStep(client, step)
  }
}

export function createFakeRunScript(options = {}) {
  const commentaryId = createId('commentary')
  const finalId = createId('final')
  const commandId = createId('command')
  const defaultTurn = [
    { type: 'thread' },
    { type: 'turnStarted' },
    {
      type: 'agentMessage',
      itemId: commentaryId,
      phase: 'commentary',
      delta: 'Reviewing context...',
      text: 'Reviewing context...',
    },
    {
      type: 'reasoning',
      text: 'Gathered relevant files and constraints before producing the final answer.',
    },
    {
      type: 'command',
      itemId: commandId,
      command: 'rg --files',
      outputDeltas: ['src/index.tsx\nserver/index.mjs\n'],
      status: 'completed',
      exitCode: 0,
    },
    {
      type: 'agentMessage',
      itemId: finalId,
      phase: 'final',
      delta: 'Completed requested change.',
      text: 'Completed requested change.',
    },
    { type: 'turnCompleted', status: 'completed' },
  ]

  return {
    turns: Array.isArray(options.turns)
      ? options.turns.map(turn => turn.map(cloneStep))
      : [defaultTurn],
    startError: options.startError,
    initializeError: options.initializeError,
    startThreadError: options.startThreadError,
    sendErrors: Array.isArray(options.sendErrors) ? [...options.sendErrors] : [],
    emitExitOnStop: options.emitExitOnStop === true,
    emitTurnCompletedOnInterrupt: options.emitTurnCompletedOnInterrupt !== false,
    emitExitOnInterrupt: options.emitExitOnInterrupt === true,
  }
}

export function configureFakeAgentHarness(options = {}) {
  queuedScripts = Array.isArray(options.scripts) ? options.scripts.map(cloneScript) : []

  scriptsByTaskId = new Map()
  const byTask = options.scriptsByTaskId || {}
  for (const [taskId, scriptOrScripts] of Object.entries(byTask)) {
    if (Array.isArray(scriptOrScripts)) {
      scriptsByTaskId.set(taskId, scriptOrScripts.map(cloneScript))
    } else {
      scriptsByTaskId.set(taskId, cloneScript(scriptOrScripts))
    }
  }

  if (typeof options.defaultScriptFactory === 'function') {
    defaultScriptFactory = options.defaultScriptFactory
  } else if (options.defaultScript) {
    const script = cloneScript(options.defaultScript)
    defaultScriptFactory = () => cloneScript(script)
  }

  sendLog.length = 0
}

export function enqueueFakeRunScript(script) {
  queuedScripts.push(cloneScript(script))
}

export function setFakeRunScriptForTask(taskId, script) {
  scriptsByTaskId.set(taskId, cloneScript(script))
}

export function getFakeAgentSendLog() {
  return [...sendLog]
}

export function resetFakeAgentHarness() {
  queuedScripts = []
  scriptsByTaskId = new Map()
  defaultScriptFactory = () => createFakeRunScript()
  sendLog.length = 0
}

export class FakeAgentClient extends EventEmitter {
  constructor({ cwd, task, threadId } = {}) {
    super()
    this.cwd = cwd
    this.task = task ?? null
    this.stopped = false
    this.interruptRequested = false
    this.turnInFlight = false
    this.sendIndex = 0
    this.threadId = threadId || createId('thread')
    this.script = selectScript(task?.id)
  }

  start() {
    if (this.script.startError) throw new Error(this.script.startError)
  }

  async initialize() {
    if (this.script.initializeError) throw new Error(this.script.initializeError)
  }

  async startThread() {
    if (this.script.startThreadError) throw new Error(this.script.startThreadError)
    return this.threadId
  }

  async sendUserText(text) {
    if (this.stopped) throw new Error('fake agent stopped')
    const currentIndex = this.sendIndex
    this.sendIndex += 1

    sendLog.push({
      index: currentIndex,
      taskId: this.task?.id ?? null,
      cwd: this.cwd,
      text,
    })

    const sendError = this.script.sendErrors?.[currentIndex]
    if (sendError) throw new Error(sendError)

    const turnSteps = this.script.turns?.[currentIndex] ?? []
    this.turnInFlight = true
    try {
      await playTurn(this, turnSteps)
    } finally {
      this.turnInFlight = false
      this.interruptRequested = false
    }
  }

  async interrupt() {
    if (this.stopped || !this.turnInFlight || this.interruptRequested) return
    this.interruptRequested = true
    if (this.script.emitTurnCompletedOnInterrupt !== false) {
      this.emit('turnCompleted', {
        turn: { status: 'interrupted' },
      })
    }
    if (this.script.emitExitOnInterrupt) {
      this.emit('exit', { code: 0, signal: null })
    }
  }

  stop() {
    this.stopped = true
    if (this.script.emitExitOnStop) {
      this.emit('exit', { code: 0, signal: null })
    }
  }
}
