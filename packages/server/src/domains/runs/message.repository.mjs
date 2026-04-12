/**
 * Message persistence — append + read for the `messages` table.
 */
import { db } from '#infra/db/index.mjs'

export function appendMessage(runId, role, kind, content, meta = null) {
  const { n } = db
    .prepare('SELECT COALESCE(MAX(seq), 0) + 1 AS n FROM messages WHERE run_id = ?')
    .get(runId)
  db.prepare(
    `INSERT INTO messages (run_id, seq, role, kind, content, meta, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(runId, n, role, kind, content, meta ? JSON.stringify(meta) : null, new Date().toISOString())
  return n
}

export function listMessages(runId) {
  return db
    .prepare('SELECT * FROM messages WHERE run_id = ? ORDER BY seq ASC')
    .all(runId)
    .map(m => ({ ...m, meta: m.meta ? JSON.parse(m.meta) : null }))
}
