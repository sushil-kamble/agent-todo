import { ACTIVE_RUN_STATUSES } from '@agent-todo/shared/constants/run-status'
import { createStore } from 'zustand/vanilla'
import type { ColumnId } from '#/entities/task/types'
import * as api from '#/features/task-board/api'
import {
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
  removeTask: (taskId: string, column: ColumnId) => Promise<void>
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
        const { statuses, workedTimes } = await api.fetchTaskStatuses(taskIds)
        set(state => {
          let changed = false
          const nextInProgress = state.tasks.in_progress.map(task => {
            if (!ACTIVE_RUN_STATUSES.has(task.runStatus ?? '')) return task
            const nextStatus = statuses[task.id] ?? undefined
            const nextWorkedTime = workedTimes[task.id] ?? null
            const nextWorkedTimeMs = nextWorkedTime?.total_ms ?? null
            const nextActiveTurnStartedAt = nextWorkedTime?.active_turn_started_at ?? null
            if (
              task.runStatus === nextStatus &&
              task.workedTimeMs === nextWorkedTimeMs &&
              task.activeTurnStartedAt === nextActiveTurnStartedAt
            ) {
              return task
            }
            changed = true
            return {
              ...task,
              runStatus: nextStatus,
              workedTimeMs: nextWorkedTimeMs,
              activeTurnStartedAt: nextActiveTurnStartedAt,
            }
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
        column_id: input.column,
        mode: input.mode,
        model: input.model,
        effort: input.effort,
        fastMode: input.fastMode,
        taskType: input.taskType ?? null,
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
        column_id: toColumn,
        position: fromColumn !== toColumn ? 0 : undefined,
        mode: updates.mode,
        model: updates.model,
        effort: updates.effort,
        fastMode: updates.fastMode,
        taskType: updates.taskType,
      })

      set(state => {
        const withoutOriginal = {
          ...state.tasks,
          [fromColumn]: state.tasks[fromColumn].filter(entry => entry.id !== taskId),
        }

        if (fromColumn === column) {
          return {
            tasks: {
              ...state.tasks,
              [column]: state.tasks[column].map(entry => (entry.id === taskId ? task : entry)),
            },
          }
        }

        return {
          tasks: {
            ...withoutOriginal,
            [column]: [task, ...withoutOriginal[column].filter(entry => entry.id !== taskId)],
          },
        }
      })
    },
    removeTask: async (taskId, column) => {
      await api.deleteTask(taskId)
      set(state => ({
        tasks: {
          ...state.tasks,
          [column]: state.tasks[column].filter(task => task.id !== taskId),
        },
      }))
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
