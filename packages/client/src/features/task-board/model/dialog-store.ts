import { createStore } from 'zustand/vanilla'
import type { ColumnId, TaskCard } from '#/entities/task/types'
import { readTaskIdFromUrl, type TaskCreateKind, writeTaskIdToUrl } from './types'

type DialogView = 'auto' | 'form' | 'chat'

type BoardDialogStore = {
  dialogOpen: boolean
  createKind: TaskCreateKind | null
  selectedTaskId: string | null
  editingColumn: ColumnId | null
  dialogView: DialogView
  openCreateTaskDialog: () => void
  openCreateBacklogDialog: () => void
  closeCreateDialog: () => void
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
    createKind: null,
    selectedTaskId: readTaskIdFromUrl(),
    editingColumn: null,
    dialogView: 'auto',
    openCreateTaskDialog: () =>
      set({
        createKind: 'task',
        dialogOpen: true,
        dialogView: 'form',
      }),
    openCreateBacklogDialog: () =>
      set({
        createKind: 'backlog',
        dialogOpen: true,
        dialogView: 'form',
      }),
    closeCreateDialog: () => set({ createKind: null, dialogOpen: false, dialogView: 'auto' }),
    openEditTask: (task, column) => {
      writeTaskIdToUrl(task.id)
      set({
        createKind: null,
        dialogOpen: false,
        selectedTaskId: task.id,
        editingColumn: column,
        dialogView: 'auto',
      })
    },
    openTaskThread: (task, column) => {
      writeTaskIdToUrl(task.id)
      set({
        createKind: null,
        dialogOpen: false,
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
