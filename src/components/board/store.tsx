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
const TASK_QUERY_PARAM = 'task'

function readTaskIdFromUrl() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(TASK_QUERY_PARAM)
}

function writeTaskIdToUrl(taskId: string | null) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (taskId) url.searchParams.set(TASK_QUERY_PARAM, taskId)
  else url.searchParams.delete(TASK_QUERY_PARAM)
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

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

type TasksStateValue = Pick<
  StoreValue,
  'tasks' | 'isLoading' | 'setTasks' | 'refresh' | 'addTask' | 'updateTask' | 'persistMove'
>
type SearchStateValue = Pick<StoreValue, 'searchQuery' | 'setSearchQuery'>
type DialogStateValue = Pick<
  StoreValue,
  | 'dialogOpen'
  | 'dialogColumn'
  | 'openNewTask'
  | 'closeNewTask'
  | 'editingTask'
  | 'editingColumn'
  | 'openEditTask'
  | 'closeEditTask'
>

const BoardTasksCtx = createContext<TasksStateValue | null>(null)
const BoardSearchCtx = createContext<SearchStateValue | null>(null)
const BoardDialogCtx = createContext<DialogStateValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TasksByColumn>(EMPTY)
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogColumn, setDialogColumn] = useState<ColumnId>('todo')
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [editingColumn, setEditingColumn] = useState<ColumnId | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [urlTaskId, setUrlTaskId] = useState<string | null>(() => readTaskIdFromUrl())

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

  // Poll only the statuses for active in-progress tasks instead of refetching
  // the entire board whenever a single run is busy.
  useEffect(() => {
    const activeTaskIds = tasks.in_progress
      .filter(task => ACTIVE_RUN_STATUSES.has(task.runStatus ?? ''))
      .map(task => task.id)
    if (activeTaskIds.length === 0) return
    const id = window.setInterval(() => {
      void api.fetchTaskStatuses(activeTaskIds).then(statuses => {
        setTasks(prev => {
          let changed = false
          const nextInProgress = prev.in_progress.map(task => {
            if (!activeTaskIds.includes(task.id)) return task
            const nextStatus = statuses[task.id] ?? undefined
            if (task.runStatus === nextStatus) return task
            changed = true
            return { ...task, runStatus: nextStatus }
          })
          return changed ? { ...prev, in_progress: nextInProgress } : prev
        })
      })
    }, 2500)
    return () => window.clearInterval(id)
  }, [tasks.in_progress])

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
    writeTaskIdToUrl(task.id)
    setUrlTaskId(task.id)
    setEditingTask(task)
    setEditingColumn(column)
  }, [])
  const closeEditTask = useCallback(() => {
    writeTaskIdToUrl(null)
    setUrlTaskId(null)
    setEditingTask(null)
    setEditingColumn(null)
    refresh()
  }, [refresh])

  useEffect(() => {
    if (isLoading || dialogOpen) return

    if (!urlTaskId) {
      if (editingTask) {
        setEditingTask(null)
        setEditingColumn(null)
      }
      return
    }

    let matchedTask: TaskCard | null = null
    let matchedColumn: ColumnId | null = null
    for (const column of Object.keys(tasks) as ColumnId[]) {
      const task = tasks[column].find(entry => entry.id === urlTaskId)
      if (task) {
        matchedTask = task
        matchedColumn = column
        break
      }
    }

    if (!matchedTask || !matchedColumn) {
      writeTaskIdToUrl(null)
      setUrlTaskId(null)
      if (editingTask) {
        setEditingTask(null)
        setEditingColumn(null)
      }
      return
    }

    if (
      editingTask?.id !== matchedTask.id ||
      editingColumn !== matchedColumn ||
      editingTask !== matchedTask
    ) {
      setEditingTask(matchedTask)
      setEditingColumn(matchedColumn)
    }
  }, [tasks, isLoading, dialogOpen, urlTaskId, editingTask, editingColumn])

  useEffect(() => {
    const syncFromLocation = () => {
      setUrlTaskId(readTaskIdFromUrl())
    }
    window.addEventListener('popstate', syncFromLocation)
    return () => window.removeEventListener('popstate', syncFromLocation)
  }, [])

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

  const tasksValue = useMemo<TasksStateValue>(
    () => ({
      tasks,
      isLoading,
      setTasks,
      refresh,
      addTask,
      updateTask,
      persistMove,
    }),
    [
      tasks,
      isLoading,
      refresh,
      addTask,
      updateTask,
      persistMove,
    ]
  )

  const searchValue = useMemo<SearchStateValue>(
    () => ({
      searchQuery,
      setSearchQuery,
    }),
    [searchQuery]
  )

  const dialogValue = useMemo<DialogStateValue>(
    () => ({
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
      editingTask,
      editingColumn,
      openEditTask,
      closeEditTask,
    }),
    [
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
      editingTask,
      editingColumn,
      openEditTask,
      closeEditTask,
    ]
  )

  return (
    <BoardTasksCtx.Provider value={tasksValue}>
      <BoardSearchCtx.Provider value={searchValue}>
        <BoardDialogCtx.Provider value={dialogValue}>{children}</BoardDialogCtx.Provider>
      </BoardSearchCtx.Provider>
    </BoardTasksCtx.Provider>
  )
}

export function useBoard() {
  return {
    ...useBoardTasks(),
    ...useBoardSearch(),
    ...useBoardDialogs(),
  }
}

export function useBoardTasks() {
  const ctx = useContext(BoardTasksCtx)
  if (!ctx) throw new Error('useBoardTasks must be used inside <BoardProvider>')
  return ctx
}

export function useBoardSearch() {
  const ctx = useContext(BoardSearchCtx)
  if (!ctx) throw new Error('useBoardSearch must be used inside <BoardProvider>')
  return ctx
}

export function useBoardDialogs() {
  const ctx = useContext(BoardDialogCtx)
  if (!ctx) throw new Error('useBoardDialogs must be used inside <BoardProvider>')
  return ctx
}
