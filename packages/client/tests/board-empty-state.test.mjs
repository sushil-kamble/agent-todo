import { describe, expect, it } from 'vitest'
import {
  getMainBoardContentState,
  getRemainingBoardLoaderMs,
  isMainBoardEmpty,
  MIN_BOARD_LOADING_MS,
} from '../src/features/task-board/model/empty-state'
import { createEmptyTasks } from '../src/features/task-board/model/types'

describe('board empty state', () => {
  it('returns true when all main board columns are empty', () => {
    expect(isMainBoardEmpty(createEmptyTasks())).toBe(true)
  })

  it('returns false when todo has tasks', () => {
    const tasks = createEmptyTasks()
    tasks.todo.push({ id: 'todo-1' })

    expect(isMainBoardEmpty(tasks)).toBe(false)
  })

  it('returns false when in progress has tasks', () => {
    const tasks = createEmptyTasks()
    tasks.in_progress.push({ id: 'run-1' })

    expect(isMainBoardEmpty(tasks)).toBe(false)
  })

  it('returns false when completed has tasks', () => {
    const tasks = createEmptyTasks()
    tasks.done.push({ id: 'done-1' })

    expect(isMainBoardEmpty(tasks)).toBe(false)
  })

  it('ignores backlog-only items when deciding the main board state', () => {
    const tasks = createEmptyTasks()
    tasks.backlog.push({ id: 'backlog-1' })

    expect(isMainBoardEmpty(tasks)).toBe(true)
  })

  it('stays false even if search would hide the existing main board tasks', () => {
    const tasks = createEmptyTasks()
    tasks.todo.push({ id: 'hidden-by-search' })

    expect(isMainBoardEmpty(tasks)).toBe(false)
  })
})

describe('main board content state', () => {
  it('returns loading before hydration completes', () => {
    expect(
      getMainBoardContentState({
        isHydrated: false,
        isLoading: false,
        tasks: createEmptyTasks(),
      })
    ).toBe('loading')
  })

  it('returns loading while the initial task fetch is in progress', () => {
    expect(
      getMainBoardContentState({
        isHydrated: true,
        isLoading: true,
        tasks: createEmptyTasks(),
      })
    ).toBe('loading')
  })

  it('returns empty once hydrated and the main board has no tasks', () => {
    expect(
      getMainBoardContentState({
        isHydrated: true,
        isLoading: false,
        tasks: createEmptyTasks(),
      })
    ).toBe('empty')
  })

  it('returns board once hydrated and at least one main board column has tasks', () => {
    const tasks = createEmptyTasks()
    tasks.todo.push({ id: 'todo-1' })

    expect(
      getMainBoardContentState({
        isHydrated: true,
        isLoading: false,
        tasks,
      })
    ).toBe('board')
  })
})

describe('board loader timing', () => {
  it('keeps the loader visible until the minimum settle duration has elapsed', () => {
    expect(
      getRemainingBoardLoaderMs({
        loadingStartedAt: 1_000,
        now: 1_240,
      })
    ).toBe(MIN_BOARD_LOADING_MS - 240)
  })

  it('returns zero once the minimum settle duration has passed', () => {
    expect(
      getRemainingBoardLoaderMs({
        loadingStartedAt: 1_000,
        now: 1_000 + MIN_BOARD_LOADING_MS,
      })
    ).toBe(0)
  })
})
