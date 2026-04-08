/**
 * Server entry point.
 *
 * Boots the database, seeds initial data, and starts the HTTP server.
 */
import { seedIfEmpty } from './db/tasks.mjs'
import { createApp } from './app.mjs'

seedIfEmpty()

const app = createApp()
const PORT = Number(process.env.PORT) || 8787

app.listen(PORT, () => {
  console.log(`[agent-todo server] listening on :${PORT}`)
})
