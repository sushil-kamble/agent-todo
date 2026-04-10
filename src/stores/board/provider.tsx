import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import type { ColumnId, TaskCard } from '#/components/board/types'
import { type BoardDialogStoreApi, createBoardDialogStore } from './dialog-store'
import { type BoardSearchStoreApi, createBoardSearchStore } from './search-store'
import { type BoardTasksStoreApi, createBoardTasksStore } from './tasks-store'
import { ACTIVE_RUN_STATUSES, readTaskIdFromUrl, type TasksByColumn } from './types'

type BoardStores = {
  tasksStore: BoardTasksStoreApi
  searchStore: BoardSearchStoreApi
  dialogStore: BoardDialogStoreApi
}

const BoardStoresContext = createContext<BoardStores | null>(null)

function findTaskSelection(tasks: TasksByColumn, taskId: string | null) {
  if (!taskId) return null

  for (const column of Object.keys(tasks) as ColumnId[]) {
    const task = tasks[column].find(entry => entry.id === taskId)
    if (task) return { column, task }
  }

  return null
}

function BoardStoreEffects() {
  const { tasksStore, dialogStore } = useBoardStores()
  const refresh = useStore(tasksStore, state => state.refresh)
  const syncActiveTaskStatuses = useStore(tasksStore, state => state.syncActiveTaskStatuses)
  const tasks = useStore(tasksStore, state => state.tasks)
  const isLoading = useStore(tasksStore, state => state.isLoading)

  const dialogOpen = useStore(dialogStore, state => state.dialogOpen)
  const selectedTaskId = useStore(dialogStore, state => state.selectedTaskId)
  const editingColumn = useStore(dialogStore, state => state.editingColumn)
  const openNewTask = useStore(dialogStore, state => state.openNewTask)
  const setEditingColumn = useStore(dialogStore, state => state.setEditingColumn)
  const clearEditingSelection = useStore(dialogStore, state => state.clearEditingSelection)
  const syncSelectionFromLocation = useStore(dialogStore, state => state.syncSelectionFromLocation)

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const activeTaskIds = tasks.in_progress
      .filter(task => ACTIVE_RUN_STATUSES.has(task.runStatus ?? ''))
      .map(task => task.id)

    if (activeTaskIds.length === 0) return

    const intervalId = window.setInterval(() => {
      void syncActiveTaskStatuses(activeTaskIds)
    }, 2500)

    return () => window.clearInterval(intervalId)
  }, [tasks.in_progress, syncActiveTaskStatuses])

  useEffect(() => {
    if (isLoading || dialogOpen) return

    if (!selectedTaskId) {
      if (editingColumn !== null) setEditingColumn(null)
      return
    }

    const selection = findTaskSelection(tasks, selectedTaskId)

    if (!selection) {
      clearEditingSelection()
      return
    }

    if (editingColumn !== selection.column) {
      setEditingColumn(selection.column)
    }
  }, [
    clearEditingSelection,
    dialogOpen,
    editingColumn,
    isLoading,
    selectedTaskId,
    setEditingColumn,
    tasks,
  ])

  useEffect(() => {
    const syncFromLocation = () => {
      syncSelectionFromLocation(readTaskIdFromUrl())
    }

    syncFromLocation()
    window.addEventListener('popstate', syncFromLocation)

    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [syncSelectionFromLocation])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'n') return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      event.preventDefault()
      openNewTask('todo')
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openNewTask])

  return null
}

export function BoardProvider({ children }: { children: ReactNode }) {
  const storesRef = useRef<BoardStores | null>(null)

  if (!storesRef.current) {
    storesRef.current = {
      tasksStore: createBoardTasksStore(),
      searchStore: createBoardSearchStore(),
      dialogStore: createBoardDialogStore(),
    }
  }

  return (
    <BoardStoresContext.Provider value={storesRef.current}>
      <BoardStoreEffects />
      {children}
    </BoardStoresContext.Provider>
  )
}

function useBoardStores() {
  const stores = useContext(BoardStoresContext)
  if (!stores) throw new Error('Board stores are only available inside <BoardProvider>')
  return stores
}

export function useBoardTasks() {
  const { tasksStore } = useBoardStores()
  const tasks = useStore(tasksStore, state => state.tasks)
  const isLoading = useStore(tasksStore, state => state.isLoading)
  const setTasks = useStore(tasksStore, state => state.setTasks)
  const refresh = useStore(tasksStore, state => state.refresh)
  const addTask = useStore(tasksStore, state => state.addTask)
  const updateTask = useStore(tasksStore, state => state.updateTask)
  const persistMove = useStore(tasksStore, state => state.persistMove)

  return {
    tasks,
    isLoading,
    setTasks,
    refresh,
    addTask,
    updateTask,
    persistMove,
  }
}

export function useBoardSearch() {
  const { searchStore } = useBoardStores()
  const searchQuery = useStore(searchStore, state => state.searchQuery)
  const setSearchQuery = useStore(searchStore, state => state.setSearchQuery)

  return {
    searchQuery,
    setSearchQuery,
  }
}

export function useBoardDialogs() {
  const { dialogStore, tasksStore } = useBoardStores()
  const dialogOpen = useStore(dialogStore, state => state.dialogOpen)
  const dialogColumn = useStore(dialogStore, state => state.dialogColumn)
  const selectedTaskId = useStore(dialogStore, state => state.selectedTaskId)
  const editingColumn = useStore(dialogStore, state => state.editingColumn)
  const openNewTask = useStore(dialogStore, state => state.openNewTask)
  const closeNewTask = useStore(dialogStore, state => state.closeNewTask)
  const openEditTask = useStore(dialogStore, state => state.openEditTask)
  const closeEditTask = useStore(dialogStore, state => state.closeEditTask)
  const tasks = useStore(tasksStore, state => state.tasks)

  const editingTask = useMemo<TaskCard | null>(() => {
    const selection = findTaskSelection(tasks, selectedTaskId)
    return selection?.task ?? null
  }, [selectedTaskId, tasks])

  return {
    dialogOpen,
    dialogColumn,
    openNewTask,
    closeNewTask,
    editingTask,
    editingColumn,
    openEditTask,
    closeEditTask,
  }
}

export function useBoard() {
  return {
    ...useBoardTasks(),
    ...useBoardSearch(),
    ...useBoardDialogs(),
  }
}
