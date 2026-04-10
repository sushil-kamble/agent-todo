import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetAgentRegistry } from '../../server/agents/index.mjs'
import {
  closeDatabase,
  configureDatabase,
  getDatabasePath,
  resetDatabase,
} from '../../server/db/index.mjs'
import * as messages from '../../server/db/messages.mjs'
import * as runs from '../../server/db/runs.mjs'
import * as tasks from '../../server/db/tasks.mjs'
import { resetRunManagerState } from '../../server/services/run-manager.mjs'
import { resetFakeAgentHarness } from '../../server/testing/fake-agent.mjs'

export function bootstrapTestDatabase(label = 'suite') {
  const root = mkdtempSync(join(tmpdir(), `agent-todo-${label}-`))
  const dbPath = join(root, 'agent-todo.test.db')

  process.env.AGENT_TODO_DB_PATH = dbPath
  configureDatabase({ path: dbPath })
  resetDatabase()
  resetRunManagerState()
  resetAgentRegistry()
  resetFakeAgentHarness()

  return {
    dbPath,
    root,
    tasks,
    runs,
    messages,
    reset() {
      resetDatabase()
      resetRunManagerState()
      resetAgentRegistry()
      resetFakeAgentHarness()
    },
    cleanup() {
      resetDatabase()
      resetRunManagerState()
      resetAgentRegistry()
      resetFakeAgentHarness()
      closeDatabase()
      rmSync(root, { recursive: true, force: true })
    },
  }
}

export function currentTestDbPath() {
  return getDatabasePath()
}
