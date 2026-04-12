import type { CreateProjectRequest } from '../contracts/project'

export function isCreateProjectRequest(value: unknown): value is CreateProjectRequest {
  if (!value || typeof value !== 'object') return false
  return typeof (value as Partial<CreateProjectRequest>).path === 'string'
}
