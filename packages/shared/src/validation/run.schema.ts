import type { SendFollowUpRequest } from '../contracts/run'

export function isSendFollowUpRequest(value: unknown): value is SendFollowUpRequest {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Partial<SendFollowUpRequest>).text === 'string'
}
