import { createStore } from 'zustand/vanilla'
import type { ColumnId } from '#/components/board/types'
import * as api from '#/lib/api'
import {
  ACTIVE_RUN_STATUSES,
  applyTasksUpdate,
  type CreateTaskInput,
  createEmptyTasks,
  type TasksByColumn,
  type TasksUpdater,
  type UpdateTaskInput,
} from './types'

type BoardTasksStore = {
  tasks: TasksByColumn
  isLoading: boolean
  setTasks: (updater: TasksUpdater) => void
  refresh: () => Promise<void>
  syncActiveTaskStatuses: (taskIds: string[]) => Promise<void>
  addTask: (input: CreateTaskInput) => Promise<void>
  updateTask: (
    taskId: string,
    updates: UpdateTaskInput,
    fromColumn: ColumnId,
    toColumn: ColumnId
  ) => Promise<void>
  persistMove: (taskId: string, toColumn: ColumnId, position: number) => Promise<string | null>
}

export function createBoardTasksStore() {
  return createStore<BoardTasksStore>((set, get) => ({
    tasks: createEmptyTasks(),
    isLoading: true,
    setTasks: updater =>
      set(state => ({
        tasks: applyTasksUpdate(state.tasks, updater),
      })),
    refresh: async () => {
      try {
        const tasks = await api.fetchTasks()
        set({ tasks })
      } catch (error) {
        console.error('[board] fetchTasks failed', error)
      } finally {
        set({ isLoading: false })
      }
    },
    syncActiveTaskStatuses: async taskIds => {
      if (taskIds.length === 0) return

      try {
        const statuses = await api.fetchTaskStatuses(taskIds)
        set(state => {
          let changed = false
          const nextInProgress = state.tasks.in_progress.map(task => {
            if (!ACTIVE_RUN_STATUSES.has(task.runStatus ?? '')) return task
            const nextStatus = statuses[task.id] ?? undefined
            if (task.runStatus === nextStatus) return task
            changed = true
            return { ...task, runStatus: nextStatus }
          })

          if (!changed) return state

          return {
            tasks: {
              ...state.tasks,
              in_progress: nextInProgress,
            },
          }
        })
      } catch (error) {
        console.error('[board] fetchTaskStatuses failed', error)
      }
    },
    addTask: async input => {
      const { task, column } = await api.createTask({
        title: input.title.trim(),
        project: input.project.trim() || 'untitled',
        agent: input.agent,
        tag: input.tag?.trim() || undefined,
        column_id: input.column,
        mode: input.mode,
        model: input.model,
        effort: input.effort,
      })

      set(state => ({
        tasks: {
          ...state.tasks,
          [column]: [task, ...state.tasks[column]],
        },
      }))
    },
    updateTask: async (taskId, updates, fromColumn, toColumn) => {
      const { task, column } = await api.patchTask(taskId, {
        title: updates.title.trim(),
        project: updates.project.trim() || 'untitled',
        agent: updates.agent,
        tag: updates.tag?.trim() || null,
        column_id: toColumn,
        mode: updates.mode,
        model: updates.model,
        effort: updates.effort,
      })

      set(state => {
        const withoutOriginal = {
          ...state.tasks,
          [fromColumn]: state.tasks[fromColumn].filter(entry => entry.id !== taskId),
        }

        return {
          tasks: {
            ...withoutOriginal,
            [column]: [task, ...withoutOriginal[column].filter(entry => entry.id !== taskId)],
          },
        }
      })
    },
    persistMove: async (taskId, toColumn, position) => {
      try {
        const { runId } = await api.patchTask(taskId, {
          column_id: toColumn,
          position,
        })

        if (toColumn === 'in_progress' && runId) {
          get().setTasks(current => ({
            ...current,
            in_progress: current.in_progress.map(task =>
              task.id === taskId ? { ...task, runStatus: 'starting' } : task
            ),
          }))
        }

        return runId
      } catch (error) {
        console.error('[board] persistMove failed', error)
        return null
      }
    },
  }))
}

export type { BoardTasksStore }
export type BoardTasksStoreApi = ReturnType<typeof createBoardTasksStore>
