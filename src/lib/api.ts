import type { Agent, ColumnId, TaskCard } from '#/components/board/types'

type ServerTask = {
  id: string
  title: string
  project: string
  agent: Agent
  tag: string | null
  column_id: ColumnId
  position: number
  created_at: string
  run_status: string | null
}

export type RunSummary = {
  id: string
  task_id: string
  agent: string
  thread_id: string | null
  status: string
  created_at: string
}

export type RunMessage = {
  id: number
  run_id: string
  seq: number
  role: 'user' | 'agent' | 'system'
  kind: 'text' | 'command' | 'status' | 'error'
  content: string
  meta: unknown
  created_at: string
}

/** Agent-message phase: "commentary" = thinking/preamble; "final" = the reply. */
export type AgentPhase = 'commentary' | 'final'

export type RunEvent =
  | ({ type: 'message' } & {
      seq: number
      role: RunMessage['role']
      kind: RunMessage['kind']
      content: string
      phase?: AgentPhase
      itemId?: string
      source?: string
      createdAt: string
    })
  | { type: 'delta'; itemId: string; delta: string }
  | { type: 'turnStarted'; turnId: string }
  | {
      type: 'itemStarted'
      itemType: string
      itemId: string
      command?: string
      cwd?: string
      phase?: AgentPhase
    }
  | { type: 'commandDelta'; itemId: string; delta: string }
  | { type: 'turnCompleted'; status?: string }
  | { type: 'end' }

function toCard(t: ServerTask): TaskCard {
  return {
    id: t.id,
    title: t.title,
    project: t.project,
    agent: t.agent,
    tag: t.tag ?? undefined,
    createdAt: t.created_at,
    runStatus: t.run_status ?? undefined,
  }
}

export async function fetchTasks(): Promise<Record<ColumnId, TaskCard[]>> {
  const r = await fetch('/api/tasks')
  const { tasks } = (await r.json()) as { tasks: ServerTask[] }
  const out: Record<ColumnId, TaskCard[]> = { todo: [], in_progress: [], done: [] }
  for (const t of tasks) out[t.column_id].push(toCard(t))
  return out
}

export async function fetchTaskStatuses(taskIds: string[]): Promise<Record<string, string | null>> {
  if (taskIds.length === 0) return {}
  const query = new URLSearchParams({ ids: taskIds.join(',') })
  const r = await fetch(`/api/tasks/statuses?${query.toString()}`)
  const { statuses } = (await r.json()) as { statuses: Record<string, string | null> }
  return statuses
}

export async function createTask(input: {
  title: string
  project: string
  agent: Agent
  tag?: string
  column_id: ColumnId
}): Promise<{ task: TaskCard; column: ColumnId }> {
  const r = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const { task } = (await r.json()) as { task: ServerTask }
  return { task: toCard(task), column: task.column_id }
}

export async function resolveDirectoryPath(path: string): Promise<string> {
  const r = await fetch('/api/paths/resolve-directory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const { path: resolved } = (await r.json()) as { path: string }
  return resolved
}

export async function patchTask(
  id: string,
  updates: Partial<{
    title: string
    project: string
    agent: Agent
    tag: string | null
    column_id: ColumnId
    position: number
  }>
): Promise<{ task: TaskCard; column: ColumnId; runId: string | null }> {
  const r = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(updates),
  })
  const { task, runId } = (await r.json()) as { task: ServerTask; runId: string | null }
  return { task: toCard(task), column: task.column_id, runId }
}

export async function deleteTask(id: string): Promise<void> {
  await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
}

export async function fetchRun(
  taskId: string
): Promise<{ run: RunSummary | null; messages: RunMessage[] }> {
  const r = await fetch(`/api/tasks/${taskId}/run`)
  return (await r.json()) as { run: RunSummary | null; messages: RunMessage[] }
}

export async function sendFollowUp(runId: string, text: string): Promise<void> {
  await fetch(`/api/runs/${runId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export type AgentSubscription = {
  installed: boolean
  plan: string | null
}

export type Subscriptions = {
  claude: AgentSubscription
  codex: AgentSubscription
}

export async function fetchSubscriptions(): Promise<Subscriptions> {
  const r = await fetch('/api/subscriptions')
  return (await r.json()) as Subscriptions
}

export function subscribeRunEvents(runId: string, onEvent: (e: RunEvent) => void): () => void {
  const es = new EventSource(`/api/runs/${runId}/events`)
  es.onmessage = ev => {
    try {
      onEvent(JSON.parse(ev.data) as RunEvent)
    } catch {}
  }
  es.onerror = () => {
    // let caller handle reconnection via close
  }
  return () => es.close()
}
