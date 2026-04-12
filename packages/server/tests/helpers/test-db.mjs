import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resetAgentRegistry } from '#domains/agents/agent-registry.mjs'
import * as messages from '#domains/runs/message.repository.mjs'
import * as runs from '#domains/runs/run.repository.mjs'
import { resetRunManagerState } from '#domains/runs/run-manager.mjs'
import * as tasks from '#domains/tasks/task.repository.mjs'
import {
  closeDatabase,
  configureDatabase,
  getDatabasePath,
  resetDatabase,
} from '#infra/db/index.mjs'
import { resetFakeAgentHarness } from '#testing/fake-agent.mjs'

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
