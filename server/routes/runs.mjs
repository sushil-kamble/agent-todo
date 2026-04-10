/**
 * Run API routes.
 *
 * POST /api/runs/:id/messages  — send a follow-up message to an active run
 * GET  /api/runs/:id/events    — SSE stream of run events
 */

import { appendMessage, listMessages } from '../db/messages.mjs'
import { json, readBody, sseHeaders, sseSend } from '../lib/http.mjs'
import { emit, getLiveRun } from '../services/run-manager.mjs'

export async function handleRunRoutes(req, res, pathname) {
  // POST /api/runs/:id/messages
  let m = pathname.match(/^\/api\/runs\/([^/]+)\/messages$/)
  if (req.method === 'POST' && m) {
    const runId = m[1]
    const body = await readBody(req)
    const text = String(body.text || '').trim()
    if (!text) return json(res, 400, { error: 'text required' })
    const entry = getLiveRun(runId)
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
        createdAt: msg.created_at,
      })
    }
    const entry = getLiveRun(runId)
    if (!entry) {
      sseSend(res, { type: 'end' })
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
