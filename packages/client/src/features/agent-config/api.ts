import type { Subscriptions } from '@agent-todo/shared/contracts/subscription'

const CACHE_TTL_MS = 5 * 60 * 1000

let subsCache: { data: Subscriptions; expiresAt: number } | null = null
let subsRequest: Promise<Subscriptions> | null = null

export async function fetchSubscriptions(): Promise<Subscriptions> {
  const now = Date.now()
  if (subsCache && now < subsCache.expiresAt) {
    return subsCache.data
  }
  if (subsRequest) return subsRequest

  subsRequest = fetch('/api/subscriptions')
    .then(async response => {
      const data = (await response.json()) as Subscriptions
      subsCache = { data, expiresAt: Date.now() + CACHE_TTL_MS }
      return data
    })
    .finally(() => {
      subsRequest = null
    })

  return subsRequest
}
