import type { Subscriptions } from '@agent-todo/shared/contracts/subscription'

export async function fetchSubscriptions(): Promise<Subscriptions> {
  const response = await fetch('/api/subscriptions')
  return (await response.json()) as Subscriptions
}
