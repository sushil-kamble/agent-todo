import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as api from '#/lib/api'
import type { Agent, ColumnId, TaskCard } from './types'

type TasksByColumn = Record<ColumnId, TaskCard[]>

const EMPTY: TasksByColumn = { todo: [], in_progress: [], done: [] }
const ACTIVE_RUN_STATUSES = new Set(['starting', 'running', 'active'])

type StoreValue = {
  tasks: TasksByColumn
  isLoading: boolean
  /**
   * Local-only setter. Use for optimistic UI (e.g. dnd reorder) — does NOT
   * persist. Call persistMove/persistReorder afterwards to sync with the server.
   */
  setTasks: React.Dispatch<React.SetStateAction<TasksByColumn>>
  refresh: () => Promise<void>

  searchQuery: string
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>

  addTask: (input: {
    title: string
    project: string
    agent: Agent
    tag?: string
    column: ColumnId
  }) => Promise<void>
  updateTask: (
    taskId: string,
    updates: { title: string; project: string; agent: Agent; tag?: string },
    fromColumn: ColumnId,
    toColumn: ColumnId
  ) => Promise<void>
  persistMove: (taskId: string, toColumn: ColumnId, position: number) => Promise<string | null>

  // New task dialog
  dialogOpen: boolean
  dialogColumn: ColumnId
  openNewTask: (column?: ColumnId) => void
  closeNewTask: () => void

  // Edit / chat dialog
  editingTask: TaskCard | null
  editingColumn: ColumnId | null
  openEditTask: (task: TaskCard, column: ColumnId) => void
  closeEditTask: () => void
}

const BoardCtx = createContext<StoreValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TasksByColumn>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogColumn, setDialogColumn] = useState<ColumnId>('todo')
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [editingColumn, setEditingColumn] = useState<ColumnId | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const refresh = useCallback(async () => {
    try {
      const t = await api.fetchTasks()
      setTasks(t)
    } catch (e) {
      console.error('[board] fetchTasks failed', e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Poll only while at least one visible in-progress task has an actively
  // changing run status. Idle tasks can remain in the column for follow-up, but
  // they should not keep the whole board polling forever.
  useEffect(() => {
    const hasActiveRun = tasks.in_progress.some(task =>
      ACTIVE_RUN_STATUSES.has(task.runStatus ?? '')
    )
    if (!hasActiveRun) return
    const id = window.setInterval(() => {
      refresh()
    }, 2500)
    return () => window.clearInterval(id)
  }, [tasks.in_progress, refresh])

  const addTask = useCallback<StoreValue['addTask']>(async input => {
    const { task, column } = await api.createTask({
      title: input.title.trim(),
      project: input.project.trim() || 'untitled',
      agent: input.agent,
      tag: input.tag?.trim() || undefined,
      column_id: input.column,
    })
    setTasks(prev => ({ ...prev, [column]: [task, ...prev[column]] }))
  }, [])

  const updateTask = useCallback<StoreValue['updateTask']>(
    async (taskId, updates, fromColumn, toColumn) => {
      const { task, column } = await (async () => {
        const r = await api.patchTask(taskId, {
          title: updates.title.trim(),
          project: updates.project.trim() || 'untitled',
          agent: updates.agent,
          tag: updates.tag?.trim() || null,
          column_id: toColumn,
        })
        return r
      })()
      setTasks(prev => {
        const without = {
          ...prev,
          [fromColumn]: prev[fromColumn].filter(t => t.id !== taskId),
        }
        return {
          ...without,
          [column]: [task, ...without[column].filter(t => t.id !== taskId)],
        }
      })
    },
    []
  )

  const persistMove = useCallback<StoreValue['persistMove']>(async (taskId, toColumn, position) => {
    try {
      const { runId } = await api.patchTask(taskId, { column_id: toColumn, position })
      if (toColumn === 'in_progress' && runId) {
        setTasks(prev => ({
          ...prev,
          in_progress: prev.in_progress.map(task =>
            task.id === taskId ? { ...task, runStatus: 'starting' } : task
          ),
        }))
      }
      return runId
    } catch (e) {
      console.error('[board] persistMove failed', e)
      return null
    }
  }, [])

  const openNewTask = useCallback((column: ColumnId = 'todo') => {
    setDialogColumn(column)
    setDialogOpen(true)
  }, [])
  const closeNewTask = useCallback(() => setDialogOpen(false), [])

  const openEditTask = useCallback((task: TaskCard, column: ColumnId) => {
    setEditingTask(task)
    setEditingColumn(column)
  }, [])
  const closeEditTask = useCallback(() => {
    setEditingTask(null)
    setEditingColumn(null)
    refresh()
  }, [refresh])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'n') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      e.preventDefault()
      setDialogColumn('todo')
      setDialogOpen(true)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const value = useMemo<StoreValue>(
    () => ({
      tasks,
      isLoading,
      setTasks,
      refresh,
      addTask,
      updateTask,
      persistMove,
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
      editingTask,
      editingColumn,
      openEditTask,
      closeEditTask,
      searchQuery,
      setSearchQuery,
    }),
    [
      tasks,
      isLoading,
      refresh,
      addTask,
      updateTask,
      persistMove,
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
      editingTask,
      editingColumn,
      openEditTask,
      closeEditTask,
      searchQuery,
    ]
  )

  return <BoardCtx.Provider value={value}>{children}</BoardCtx.Provider>
}

export function useBoard() {
  const ctx = useContext(BoardCtx)
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>')
  return ctx
}
