import { MAIN_BOARD_COLUMN_IDS } from '#/entities/task/types'
import type { TasksByColumn } from './types'

export type MainBoardContentState = 'loading' | 'empty' | 'board'
export const MIN_BOARD_LOADING_MS = 2000

export function isMainBoardEmpty(tasks: TasksByColumn) {
  return MAIN_BOARD_COLUMN_IDS.every(columnId => tasks[columnId].length === 0)
}

export function getMainBoardContentState({
  isHydrated,
  isLoading,
  tasks,
}: {
  isHydrated: boolean
  isLoading: boolean
  tasks: TasksByColumn
}): MainBoardContentState {
  if (!isHydrated || isLoading) return 'loading'
  return isMainBoardEmpty(tasks) ? 'empty' : 'board'
}

export function getRemainingBoardLoaderMs({
  loadingStartedAt,
  now = Date.now(),
  minimumDurationMs = MIN_BOARD_LOADING_MS,
}: {
  loadingStartedAt: number
  now?: number
  minimumDurationMs?: number
}) {
  return Math.max(0, minimumDurationMs - Math.max(0, now - loadingStartedAt))
}
