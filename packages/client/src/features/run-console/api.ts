import type {
  RunEvent,
  RunMessage,
  RunSummary,
  StopRunResponse,
} from '@agent-todo/shared/contracts/run'
import type { TaskRunResponse } from '@agent-todo/shared/contracts/task'

export async function fetchRun(
  taskId: string,
  options?: {
    autostart?: boolean
  }
): Promise<{ run: RunSummary | null; messages: RunMessage[] }> {
  const query = new URLSearchParams()
  if (options?.autostart === false) query.set('autostart', 'false')
  const suffix = query.size > 0 ? `?${query.toString()}` : ''
  const response = await fetch(`/api/tasks/${taskId}/run${suffix}`)
  return (await response.json()) as TaskRunResponse
}

export async function sendFollowUp(runId: string, text: string): Promise<void> {
  const response = await fetch(`/api/runs/${runId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'failed to send follow-up')
  }
}

export async function stopRun(runId: string): Promise<RunSummary | null> {
  const response = await fetch(`/api/runs/${runId}/stop`, {
    method: 'POST',
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? 'failed to stop run')
  }
  const body = (await response.json()) as StopRunResponse
  return body.run
}

export function subscribeRunEvents(runId: string, onEvent: (event: RunEvent) => void): () => void {
  const eventSource = new EventSource(`/api/runs/${runId}/events`)
  eventSource.onmessage = event => {
    try {
      onEvent(JSON.parse(event.data) as RunEvent)
    } catch {}
  }
  eventSource.onerror = () => {}
  return () => eventSource.close()
}
