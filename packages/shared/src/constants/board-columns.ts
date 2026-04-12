import type { ColumnId } from '../contracts/task'

export type Column = {
  id: ColumnId
  label: string
  hint: string
}

export const BOARD_COLUMN_IDS: ColumnId[] = ['todo', 'in_progress', 'done']

export const COLUMNS: Column[] = [
  { id: 'todo', label: 'Todo', hint: 'Queued for pickup' },
  { id: 'in_progress', label: 'In Progress', hint: 'Agent is working' },
  { id: 'done', label: 'Completed', hint: 'Shipped & verified' },
]
