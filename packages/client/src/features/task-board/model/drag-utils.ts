import { arrayMove } from '@dnd-kit/sortable'
import type { ColumnId } from '#/entities/task/types'
import { BOARD_COLUMN_IDS } from '#/entities/task/types'
import type { TasksByColumn } from './types'

export type DropLocation = {
  column: ColumnId
  index: number
}

export function findTaskColumn(tasks: TasksByColumn, id: string): ColumnId | null {
  if (BOARD_COLUMN_IDS.includes(id as ColumnId)) {
    return id as ColumnId
  }

  for (const column of BOARD_COLUMN_IDS) {
    if (tasks[column].some(task => task.id === id)) return column
  }

  return null
}

export function resolveDropLocation(tasks: TasksByColumn, overId: string): DropLocation | null {
  if (BOARD_COLUMN_IDS.includes(overId as ColumnId)) {
    const column = overId as ColumnId
    return { column, index: tasks[column].length }
  }

  const column = findTaskColumn(tasks, overId)
  if (!column) return null

  const index = tasks[column].findIndex(task => task.id === overId)
  if (index === -1) return null

  return { column, index }
}

export function insertTaskAtDropLocation(
  tasks: TasksByColumn,
  taskId: string,
  fromColumn: ColumnId,
  location: DropLocation
): TasksByColumn {
  if (fromColumn === location.column) return tasks

  const movingTask = tasks[fromColumn].find(task => task.id === taskId)
  if (!movingTask) return tasks

  const nextSource = tasks[fromColumn].filter(task => task.id !== taskId)
  const nextTarget = tasks[location.column].filter(task => task.id !== taskId)
  const nextIndex = Math.max(0, Math.min(location.index, nextTarget.length))

  return {
    ...tasks,
    [fromColumn]: nextSource,
    [location.column]: [
      ...nextTarget.slice(0, nextIndex),
      movingTask,
      ...nextTarget.slice(nextIndex),
    ],
  }
}

export function reorderTasksInColumn(
  tasks: TasksByColumn,
  column: ColumnId,
  taskId: string,
  nextIndex: number
): TasksByColumn {
  const items = tasks[column]
  const oldIndex = items.findIndex(task => task.id === taskId)
  if (oldIndex === -1) return tasks

  const boundedIndex = Math.max(0, Math.min(nextIndex, items.length - 1))
  if (boundedIndex === oldIndex) return tasks

  return {
    ...tasks,
    [column]: arrayMove(items, oldIndex, boundedIndex),
  }
}
