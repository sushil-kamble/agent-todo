import { seedProjectsFromTasks } from '../domains/projects/project.repository.mjs'
import { resetRunManagerState } from '../domains/runs/run-manager.mjs'
import { seedIfEmpty } from '../domains/tasks/task.repository.mjs'
import { closeDatabase } from '../infrastructure/db/index.mjs'
import { createApp } from './http-server.mjs'

export async function startServer() {
  if (process.env.AGENT_TODO_FAKE_AGENT_MODE === '1') {
    const { enableFakeE2EMode } = await import('../testing/e2e-mode.mjs')
    await enableFakeE2EMode()
  } else {
    seedIfEmpty()
    seedProjectsFromTasks()
  }

  const app = createApp()
  const port = Number(process.env.PORT) || 8787
  const server = app.listen(port, () => {
    console.log(`[agentodo server] listening on :${port}`)
  })

  function shutdown() {
    console.log('[agentodo server] shutting down...')
    resetRunManagerState()
    server.close(() => {
      closeDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return server
}
