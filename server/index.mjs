/**
 * Server entry point.
 *
 * Boots the database, seeds initial data, and starts the HTTP server.
 */

import { createApp } from './app.mjs'
import { seedIfEmpty } from './db/tasks.mjs'

if (process.env.AGENT_TODO_FAKE_AGENT_MODE === '1') {
  const { enableFakeE2EMode } = await import('./testing/e2e-mode.mjs')
  await enableFakeE2EMode()
} else {
  seedIfEmpty()
}

const app = createApp()
const PORT = Number(process.env.PORT) || 8787

app.listen(PORT, () => {
  console.log(`[agent-todo server] listening on :${PORT}`)
})
