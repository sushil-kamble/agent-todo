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
  kind: 'text' | 'reasoning' | 'command' | 'status' | 'error'
  content: string
  meta: unknown
  created_at: string
}

export type AgentPhase = 'commentary' | 'final'
export type ReasoningProvider = 'claude' | 'codex'
export type ReasoningFormat = 'summary' | 'raw'

export type RunEvent =
  | ({ type: 'message' } & {
      seq: number
      role: RunMessage['role']
      kind: RunMessage['kind']
      content: string
      phase?: AgentPhase
      itemId?: string
      provider?: ReasoningProvider
      reasoningFormat?: ReasoningFormat
      interruptedByUser?: boolean
      createdAt: string
    })
  | {
      type: 'delta'
      itemId: string
      kind: 'text' | 'reasoning'
      delta: string
      phase?: AgentPhase
      provider?: ReasoningProvider
      reasoningFormat?: ReasoningFormat
    }
  | { type: 'turnStarted'; turnId: string }
  | {
      type: 'itemStarted'
      itemType: string
      itemId: string
      command?: string
      cwd?: string
      phase?: AgentPhase
      provider?: ReasoningProvider
      reasoningFormat?: ReasoningFormat
    }
  | { type: 'commandDelta'; itemId: string; delta: string }
  | { type: 'turnCompleted'; status?: string }
  | { type: 'end'; status?: string }

export type SendFollowUpRequest = {
  text: string
}

export type StopRunResponse = {
  run: RunSummary | null
}
