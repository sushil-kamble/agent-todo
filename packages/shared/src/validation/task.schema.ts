import { isAgent } from '../config/agents'
import { isTaskMode } from '../config/task-modes'
import { isTaskType } from '../config/task-types'
import { BOARD_COLUMN_IDS } from '../constants/board-columns'
import type { CreateTaskRequest } from '../contracts/task'

export function isCreateTaskRequest(value: unknown): value is CreateTaskRequest {
  if (!value || typeof value !== 'object') return false
  const input = value as Partial<CreateTaskRequest>
  return (
    typeof input.title === 'string' &&
    typeof input.project === 'string' &&
    isAgent(input.agent) &&
    BOARD_COLUMN_IDS.includes(input.column_id ?? 'todo') &&
    (input.mode === undefined || isTaskMode(input.mode)) &&
    (input.fastMode === undefined || typeof input.fastMode === 'boolean') &&
    (input.taskType === undefined || input.taskType === null || isTaskType(input.taskType))
  )
}
