import type { AgentPhase } from '#/lib/api'

export type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  body: string
  at: string
}

export type LiveMessage = {
  id: string
  role: 'user' | 'agent' | 'system'
  kind: string
  body: string
  at: string
  streaming?: boolean
  phase?: AgentPhase
  itemId?: string
  commandOutput?: string
  commandRunning?: boolean
}

export type TurnGroup = {
  user: LiveMessage | null
  thinking: LiveMessage[]
  final: LiveMessage | null
}
