import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { type Agent, type ColumnId, SEED, type TaskCard } from './types'

type TasksByColumn = Record<ColumnId, TaskCard[]>

type StoreValue = {
  tasks: TasksByColumn
  setTasks: React.Dispatch<React.SetStateAction<TasksByColumn>>
  addTask: (input: {
    title: string
    project: string
    agent: Agent
    tag?: string
    column: ColumnId
  }) => void
  updateTask: (
    taskId: string,
    updates: { title: string; project: string; agent: Agent; tag?: string },
    fromColumn: ColumnId,
    toColumn: ColumnId
  ) => void

  // New task dialog
  dialogOpen: boolean
  dialogColumn: ColumnId
  openNewTask: (column?: ColumnId) => void
  closeNewTask: () => void

  // Edit task dialog
  editingTask: TaskCard | null
  editingColumn: ColumnId | null
  openEditTask: (task: TaskCard, column: ColumnId) => void
  closeEditTask: () => void
}

const BoardCtx = createContext<StoreValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TasksByColumn>(SEED)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogColumn, setDialogColumn] = useState<ColumnId>('todo')
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [editingColumn, setEditingColumn] = useState<ColumnId | null>(null)

  const addTask = useCallback<StoreValue['addTask']>(({ title, project, agent, tag, column }) => {
    setTasks(prev => {
      const id = `t-${Math.random().toString(36).slice(2, 7)}`
      const card: TaskCard = {
        id,
        title: title.trim(),
        project: project.trim() || 'untitled',
        agent,
        tag: tag?.trim() || undefined,
        createdAt: new Date().toISOString().slice(0, 10),
      }
      return { ...prev, [column]: [card, ...prev[column]] }
    })
  }, [])

  const updateTask = useCallback<StoreValue['updateTask']>(
    (taskId, updates, fromColumn, toColumn) => {
      setTasks(prev => {
        const task = prev[fromColumn].find(t => t.id === taskId)
        if (!task) return prev
        const updated: TaskCard = {
          ...task,
          title: updates.title.trim(),
          project: updates.project.trim() || 'untitled',
          agent: updates.agent,
          tag: updates.tag?.trim() || undefined,
        }
        if (fromColumn === toColumn) {
          return {
            ...prev,
            [fromColumn]: prev[fromColumn].map(t => (t.id === taskId ? updated : t)),
          }
        }
        return {
          ...prev,
          [fromColumn]: prev[fromColumn].filter(t => t.id !== taskId),
          [toColumn]: [updated, ...prev[toColumn]],
        }
      })
    },
    []
  )

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
  }, [])

  // Global "N" shortcut to open the new task dialog (when not typing in an input)
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
      setTasks,
      addTask,
      updateTask,
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
      editingTask,
      editingColumn,
      openEditTask,
      closeEditTask,
    }),
    [tasks, addTask, updateTask, dialogOpen, dialogColumn, openNewTask, closeNewTask, editingTask, editingColumn, openEditTask, closeEditTask]
  )

  return <BoardCtx.Provider value={value}>{children}</BoardCtx.Provider>
}

export function useBoard() {
  const ctx = useContext(BoardCtx)
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>')
  return ctx
}
