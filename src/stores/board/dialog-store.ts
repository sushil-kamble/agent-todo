import { createStore } from 'zustand/vanilla'
import type { ColumnId, TaskCard } from '#/components/board/types'
import { readTaskIdFromUrl, writeTaskIdToUrl } from './types'

type BoardDialogStore = {
  dialogOpen: boolean
  dialogColumn: ColumnId
  selectedTaskId: string | null
  editingColumn: ColumnId | null
  openNewTask: (column?: ColumnId) => void
  closeNewTask: () => void
  openEditTask: (task: TaskCard, column: ColumnId) => void
  closeEditTask: () => void
  syncSelectionFromLocation: (taskId: string | null) => void
  setEditingColumn: (column: ColumnId | null) => void
  clearEditingSelection: () => void
}

export function createBoardDialogStore() {
  return createStore<BoardDialogStore>(set => ({
    dialogOpen: false,
    dialogColumn: 'todo',
    selectedTaskId: readTaskIdFromUrl(),
    editingColumn: null,
    openNewTask: (column = 'todo') =>
      set({
        dialogColumn: column,
        dialogOpen: true,
      }),
    closeNewTask: () => set({ dialogOpen: false }),
    openEditTask: (task, column) => {
      writeTaskIdToUrl(task.id)
      set({
        selectedTaskId: task.id,
        editingColumn: column,
      })
    },
    closeEditTask: () => {
      writeTaskIdToUrl(null)
      set({
        selectedTaskId: null,
        editingColumn: null,
      })
    },
    syncSelectionFromLocation: taskId =>
      set(state => ({
        selectedTaskId: taskId,
        editingColumn: taskId ? state.editingColumn : null,
      })),
    setEditingColumn: column => set({ editingColumn: column }),
    clearEditingSelection: () => {
      writeTaskIdToUrl(null)
      set({
        selectedTaskId: null,
        editingColumn: null,
      })
    },
  }))
}

export type { BoardDialogStore }
export type BoardDialogStoreApi = ReturnType<typeof createBoardDialogStore>
