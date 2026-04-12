export const ACTIVE_RUN_STATUSES = new Set(['starting', 'running', 'active'])

export const TERMINAL_RUN_STATUSES = new Set(['completed', 'failed', 'interrupted'])

export function isTerminalRunStatus(status: string | null | undefined) {
  return TERMINAL_RUN_STATUSES.has(status ?? '')
}
