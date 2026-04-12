import { resolve } from 'node:path'
import { setAgentRegistry } from '#domains/agents/agent-registry.mjs'
import { ensureRunForTask } from '#domains/runs/run-manager.mjs'
import { createTask } from '#domains/tasks/task.repository.mjs'
import { resetDatabase } from '#infra/db/index.mjs'
import {
  createFakeRunScript,
  FakeAgentClient,
  resetFakeAgentHarness,
  setFakeRunScriptForTask,
} from '#testing/fake-agent.mjs'

function isoDay() {
  return new Date().toISOString().slice(0, 10)
}

function createLongTranscriptTurn() {
  const steps = [{ type: 'thread' }, { type: 'turnStarted' }]

  for (let i = 1; i <= 20; i += 1) {
    steps.push({
      type: 'agentMessage',
      phase: 'commentary',
      delta: `Planning step ${i}...`,
      text: `Planning step ${i}: inspected files and compared constraints for the requested work.`,
    })
  }

  steps.push({
    type: 'command',
    command: 'pnpm test:core',
    outputDeltas: [' RUN  tests/core/sample.test.mjs\n', ' PASS  tests/core/sample.test.mjs\n'],
    status: 'completed',
    exitCode: 0,
  })

  steps.push({
    type: 'agentMessage',
    phase: 'final',
    delta: 'Bootstrap analysis complete.',
    text: 'Bootstrap analysis complete. Ready for follow-up instructions.',
  })

  steps.push({ type: 'turnCompleted', status: 'completed' })

  return steps
}

function createFollowUpTurn() {
  return [
    { type: 'turnStarted' },
    {
      type: 'agentMessage',
      phase: 'commentary',
      delta: 'Running follow-up...',
      text: 'Running follow-up...',
    },
    {
      type: 'agentMessage',
      phase: 'final',
      delta: 'Follow-up complete.',
      text: 'Follow-up complete. The requested update has been processed.',
    },
    { type: 'turnCompleted', status: 'completed' },
  ]
}

export async function enableFakeE2EMode() {
  setAgentRegistry({ codex: FakeAgentClient, claude: FakeAgentClient })
  resetFakeAgentHarness()
  resetDatabase()

  const today = isoDay()
  const workspaceServerPath = resolve(process.cwd(), 'server')

  createTask({
    id: 't-e2e-todo',
    title: 'E2E Todo Task',
    project: workspaceServerPath,
    agent: 'codex',
    tag: 'e2e',
    column_id: 'todo',
    created_at: today,
  })

  const activeTask = createTask({
    id: 't-e2e-live',
    title: 'E2E In Progress Task',
    project: workspaceServerPath,
    agent: 'claude',
    tag: 'stream',
    column_id: 'in_progress',
    created_at: today,
  })

  createTask({
    id: 't-e2e-done',
    title: 'E2E Completed Task',
    project: workspaceServerPath,
    agent: 'codex',
    tag: 'done',
    column_id: 'done',
    created_at: today,
  })

  setFakeRunScriptForTask(
    activeTask.id,
    createFakeRunScript({
      turns: [createLongTranscriptTurn(), createFollowUpTurn()],
    })
  )

  await ensureRunForTask(activeTask)
}
