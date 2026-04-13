/**
 * Run API routes.
 *
 * POST /api/runs/:id/messages  — send a follow-up message to an active run
 * POST /api/runs/:id/stop      — interrupt an active run
 * GET  /api/runs/:id/events    — SSE stream of run events
 */

import { json, readBody, sseHeaders, sseSend } from '#infra/http/http.mjs'
import { appendMessage, listMessages } from './message.repository.mjs'
import { getRun } from './run.repository.mjs'
import { emit, ensureLiveRun, getLiveRun, interruptRun } from './run-manager.mjs'

const USER_CANCELLED_EXECUTION = '--- User cancelled execution ---'

export async function handleRunRoutes(req, res, pathname) {
  // POST /api/runs/:id/messages
  let m = pathname.match(/^\/api\/runs\/([^/]+)\/messages$/)
  if (req.method === 'POST' && m) {
    const runId = m[1]
    const body = await readBody(req)
    const text = String(body.text || '').trim()
    if (!text) return json(res, 400, { error: 'text required' })
    let entry = getLiveRun(runId)
    if (!entry) {
      await ensureLiveRun(runId)
      entry = getLiveRun(runId)
    }
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
      await entry.ready
      await entry.client.sendUserText(text)
    } catch (e) {
      return json(res, 500, { error: e.message })
    }
    return json(res, 200, { ok: true })
  }

  // POST /api/runs/:id/stop
  m = pathname.match(/^\/api\/runs\/([^/]+)\/stop$/)
  if (req.method === 'POST' && m) {
    const runId = m[1]
    const run = getRun(runId)
    if (!run) return json(res, 404, { error: 'run not found' })
    const entry = getLiveRun(runId)
    if (!entry) return json(res, 404, { error: 'run not active' })
    const seq = appendMessage(runId, 'system', 'error', USER_CANCELLED_EXECUTION, {
      interruptedByUser: true,
    })
    emit(runId, {
      type: 'message',
      seq,
      role: 'system',
      kind: 'error',
      content: USER_CANCELLED_EXECUTION,
      interruptedByUser: true,
      createdAt: new Date().toISOString(),
    })
    return json(res, 200, { run: await interruptRun(runId) })
  }

  // GET /api/runs/:id/events (SSE)
  m = pathname.match(/^\/api\/runs\/([^/]+)\/events$/)
  if (req.method === 'GET' && m) {
    const runId = m[1]
    sseHeaders(res)
    // Replay persisted history
    for (const msg of listMessages(runId)) {
      const meta = msg.meta ?? null
      sseSend(res, {
        type: 'message',
        seq: msg.seq,
        role: msg.role,
        kind: msg.kind,
        content: msg.content,
        phase: meta?.phase,
        itemId: meta?.itemId,
        provider: meta?.provider,
        reasoningFormat: meta?.reasoningFormat,
        interruptedByUser: meta?.interruptedByUser === true,
        createdAt: msg.created_at,
      })
    }
    const entry = getLiveRun(runId)
    if (!entry) {
      sseSend(res, { type: 'end', status: getRun(runId)?.status })
      res.end()
      return true
    }
    const listener = ev => sseSend(res, ev)
    entry.bus.on('evt', listener)
    req.on('close', () => entry.bus.off('evt', listener))
    // Keep-alive ping
    const ping = setInterval(() => res.write(':keep-alive\n\n'), 15000)
    req.on('close', () => clearInterval(ping))
    return true
  }

  return false // not handled
}
