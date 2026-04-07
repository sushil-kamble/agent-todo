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

  // Dialog
  dialogOpen: boolean
  dialogColumn: ColumnId
  openNewTask: (column?: ColumnId) => void
  closeNewTask: () => void
}

const BoardCtx = createContext<StoreValue | null>(null)

export function BoardProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TasksByColumn>(SEED)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogColumn, setDialogColumn] = useState<ColumnId>('todo')

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

  const openNewTask = useCallback((column: ColumnId = 'todo') => {
    setDialogColumn(column)
    setDialogOpen(true)
  }, [])

  const closeNewTask = useCallback(() => setDialogOpen(false), [])

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
      dialogOpen,
      dialogColumn,
      openNewTask,
      closeNewTask,
    }),
    [tasks, addTask, dialogOpen, dialogColumn, openNewTask, closeNewTask]
  )

  return <BoardCtx.Provider value={value}>{children}</BoardCtx.Provider>
}

export function useBoard() {
  const ctx = useContext(BoardCtx)
  if (!ctx) throw new Error('useBoard must be used inside <BoardProvider>')
  return ctx
}
