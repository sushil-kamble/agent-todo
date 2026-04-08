import http from 'node:http'
import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'
import {
  appendMessage,
  createRun,
  createTask,
  deleteTask,
  getActiveRunForTask,
  getRun,
  getTask,
  listMessages,
  listTasks,
  seedIfEmpty,
  updateRun,
  updateTaskFields,
} from './db.mjs'
import { CodexClient } from './codex.mjs'

seedIfEmpty()

// In-memory registry of live runs keyed by runId
// { client: CodexClient, bus: EventEmitter, partials: Map<itemId,string> }
const runs = new Map()

function bus(runId) {
  return runs.get(runId)?.bus
}

function emit(runId, event) {
  const b = bus(runId)
  if (b) b.emit('evt', event)
}

// ---------------------- Run orchestration ----------------------

async function startCodexRun(task) {
  const runId = `r-${randomUUID().slice(0, 8)}`
  const run = createRun({
    id: runId,
    task_id: task.id,
    agent: 'codex',
    thread_id: null,
    status: 'starting',
    created_at: new Date().toISOString(),
  })

  const client = new CodexClient({ cwd: task.project })
  const b = new EventEmitter()
  b.setMaxListeners(0)
  const partials = new Map()
  runs.set(runId, { client, bus: b, partials })

  // Persist the initial user instruction
  const seq = appendMessage(runId, 'user', 'text', task.title)
  b.emit('evt', {
    type: 'message',
    seq,
    role: 'user',
    kind: 'text',
    content: task.title,
    createdAt: new Date().toISOString(),
  })

  client.on('thread', ({ threadId }) => {
    updateRun(runId, { thread_id: threadId, status: 'running' })
    const s = appendMessage(runId, 'system', 'status', `thread started: ${threadId}`)
    b.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'status',
      content: `thread started: ${threadId}`,
      createdAt: new Date().toISOString(),
    })
  })

  client.on('agentDelta', ({ itemId, delta }) => {
    const cur = partials.get(itemId) ?? ''
    partials.set(itemId, cur + delta)
    b.emit('evt', { type: 'delta', itemId, delta })
  })

  client.on('item', ({ item }) => {
    if (!item) return
    if (item.type === 'agentMessage') {
      partials.delete(item.id)
      const s = appendMessage(runId, 'agent', 'text', item.text ?? '', { itemId: item.id })
      b.emit('evt', {
        type: 'message',
        seq: s,
        role: 'agent',
        kind: 'text',
        content: item.text ?? '',
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
      b.emit('evt', {
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
    b.emit('evt', { type: 'turnCompleted', status: turn?.status })
  })

  client.on('error', ({ message }) => {
    const s = appendMessage(runId, 'system', 'error', message)
    b.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'error',
      content: message,
      createdAt: new Date().toISOString(),
    })
  })

  client.on('exit', ({ code }) => {
    const s = appendMessage(runId, 'system', 'status', `codex exited (code ${code})`)
    updateRun(runId, { status: code === 0 ? 'completed' : 'failed' })
    b.emit('evt', {
      type: 'message',
      seq: s,
      role: 'system',
      kind: 'status',
      content: `codex exited (code ${code})`,
      createdAt: new Date().toISOString(),
    })
    b.emit('evt', { type: 'end' })
    runs.delete(runId)
  })

  try {
    client.start()
    await client.initialize()
    await client.startThread()
    await client.sendUserText(task.title)
  } catch (e) {
    updateRun(runId, { status: 'failed' })
    const s = appendMessage(runId, 'system', 'error', String(e.message || e))
    b.emit('evt', {
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

async function ensureRunForTask(task) {
  if (task.agent !== 'codex') return null
  const existing = getActiveRunForTask(task.id)
  if (existing && runs.has(existing.id)) return existing
  if (existing) {
    // row exists but process is gone — mark failed and start fresh
    updateRun(existing.id, { status: 'failed' })
  }
  return startCodexRun(task)
}

// ---------------------- HTTP plumbing ----------------------

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(JSON.stringify(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })
}

function sseSend(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

// ---------------------- Routes ----------------------

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    return res.end()
  }

  const url = new URL(req.url, 'http://localhost')
  const { pathname } = url

  try {
    // GET /api/tasks
    if (req.method === 'GET' && pathname === '/api/tasks') {
      return json(res, 200, { tasks: listTasks() })
    }

    // POST /api/tasks
    if (req.method === 'POST' && pathname === '/api/tasks') {
      const body = await readBody(req)
      const id = `t-${randomUUID().slice(0, 5)}`
      const t = createTask({
        id,
        title: String(body.title || '').trim(),
        project: String(body.project || '').trim() || 'untitled',
        agent: body.agent === 'claude' ? 'claude' : 'codex',
        tag: body.tag ? String(body.tag) : null,
        column_id: ['todo', 'in_progress', 'done'].includes(body.column_id)
          ? body.column_id
          : 'todo',
        created_at: new Date().toISOString().slice(0, 10),
      })
      return json(res, 201, { task: t })
    }

    // PATCH /api/tasks/:id
    let m = pathname.match(/^\/api\/tasks\/([^/]+)$/)
    if (req.method === 'PATCH' && m) {
      const id = m[1]
      const body = await readBody(req)
      const prev = getTask(id)
      if (!prev) return json(res, 404, { error: 'not found' })
      const t = updateTaskFields(id, {
        title: body.title ?? prev.title,
        project: body.project ?? prev.project,
        agent: body.agent ?? prev.agent,
        tag: body.tag === undefined ? prev.tag : body.tag,
        column_id: body.column_id ?? prev.column_id,
        position: body.position ?? prev.position,
      })

      // If this move brought the task into in_progress and it's a codex task,
      // kick off a run.
      let runId = null
      if (
        prev.column_id !== 'in_progress' &&
        t.column_id === 'in_progress' &&
        t.agent === 'codex'
      ) {
        try {
          const run = await ensureRunForTask(t)
          runId = run?.id ?? null
        } catch (e) {
          return json(res, 500, { error: `failed to start codex: ${e.message}` })
        }
      }
      return json(res, 200, { task: t, runId })
    }

    // DELETE /api/tasks/:id
    if (req.method === 'DELETE' && m) {
      deleteTask(m[1])
      return json(res, 200, { ok: true })
    }

    // GET /api/tasks/:id/run
    m = pathname.match(/^\/api\/tasks\/([^/]+)\/run$/)
    if (req.method === 'GET' && m) {
      const run = getActiveRunForTask(m[1])
      if (!run) return json(res, 200, { run: null, messages: [] })
      return json(res, 200, { run, messages: listMessages(run.id) })
    }

    // POST /api/runs/:id/messages
    m = pathname.match(/^\/api\/runs\/([^/]+)\/messages$/)
    if (req.method === 'POST' && m) {
      const runId = m[1]
      const body = await readBody(req)
      const text = String(body.text || '').trim()
      if (!text) return json(res, 400, { error: 'text required' })
      const entry = runs.get(runId)
      if (!entry) return json(res, 404, { error: 'run not active' })
      const seq = appendMessage(runId, 'user', 'text', text)
      emit(runId, {
        type: 'message',
        seq,
        role: 'user',
        kind: 'text',
        content: text,
        createdAt: new Date().toISOString(),
      })
      try {
        await entry.client.sendUserText(text)
      } catch (e) {
        return json(res, 500, { error: e.message })
      }
      return json(res, 200, { ok: true })
    }

    // GET /api/runs/:id/events (SSE)
    m = pathname.match(/^\/api\/runs\/([^/]+)\/events$/)
    if (req.method === 'GET' && m) {
      const runId = m[1]
      sseHeaders(res)
      // replay history
      for (const msg of listMessages(runId)) {
        sseSend(res, {
          type: 'message',
          seq: msg.seq,
          role: msg.role,
          kind: msg.kind,
          content: msg.content,
          createdAt: msg.created_at,
        })
      }
      const entry = runs.get(runId)
      if (!entry) {
        sseSend(res, { type: 'end' })
        res.end()
        return
      }
      const listener = ev => sseSend(res, ev)
      entry.bus.on('evt', listener)
      req.on('close', () => entry.bus.off('evt', listener))
      // keep-alive ping
      const ping = setInterval(() => res.write(':keep-alive\n\n'), 15000)
      req.on('close', () => clearInterval(ping))
      return
    }

    json(res, 404, { error: 'not found' })
  } catch (e) {
    console.error(e)
    json(res, 500, { error: String(e.message || e) })
  }
})

const PORT = Number(process.env.PORT) || 8787
server.listen(PORT, () => {
  console.log(`[agent-todo server] listening on :${PORT}`)
})
