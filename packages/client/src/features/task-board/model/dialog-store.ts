import { createStore } from 'zustand/vanilla'
import type { ColumnId, TaskCard } from '#/entities/task/types'
import { readTaskIdFromUrl, writeTaskIdToUrl } from './types'

type DialogView = 'auto' | 'form' | 'chat'

type BoardDialogStore = {
  dialogOpen: boolean
  dialogColumn: ColumnId
  selectedTaskId: string | null
  editingColumn: ColumnId | null
  dialogView: DialogView
  openNewTask: (column?: ColumnId) => void
  closeNewTask: () => void
  openEditTask: (task: TaskCard, column: ColumnId) => void
  openTaskThread: (task: TaskCard, column: ColumnId) => void
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
    dialogView: 'auto',
    openNewTask: (column = 'todo') =>
      set({
        dialogColumn: column,
        dialogOpen: true,
        dialogView: 'form',
      }),
    closeNewTask: () => set({ dialogOpen: false, dialogView: 'auto' }),
    openEditTask: (task, column) => {
      writeTaskIdToUrl(task.id)
      set({
        selectedTaskId: task.id,
        editingColumn: column,
        dialogView: 'auto',
      })
    },
    openTaskThread: (task, column) => {
      writeTaskIdToUrl(task.id)
      set({
        selectedTaskId: task.id,
        editingColumn: column,
        dialogView: 'chat',
      })
    },
    closeEditTask: () => {
      writeTaskIdToUrl(null)
      set({
        selectedTaskId: null,
        editingColumn: null,
        dialogView: 'auto',
      })
    },
    syncSelectionFromLocation: taskId =>
      set(state => ({
        selectedTaskId: taskId,
        editingColumn: taskId ? state.editingColumn : null,
        dialogView: taskId ? state.dialogView : 'auto',
      })),
    setEditingColumn: column => set({ editingColumn: column }),
    clearEditingSelection: () => {
      writeTaskIdToUrl(null)
      set({
        selectedTaskId: null,
        editingColumn: null,
        dialogView: 'auto',
      })
    },
  }))
}

export type { BoardDialogStore }
export type BoardDialogStoreApi = ReturnType<typeof createBoardDialogStore>
