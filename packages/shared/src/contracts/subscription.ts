export type AgentUsageSnapshot = {
  fiveHourUtilization: number | null
  fiveHourResetsAt: string | null
  sevenDayUtilization: number | null
  sevenDayResetsAt: string | null
  creditsRemaining: number | null
  creditsUnlimited: boolean | null
}

export type AgentSubscription = {
  installed: boolean
  plan: string | null
  available: boolean
  reason: string | null
  usage: AgentUsageSnapshot | null
}

export type Subscriptions = {
  claude: AgentSubscription
  codex: AgentSubscription
}
