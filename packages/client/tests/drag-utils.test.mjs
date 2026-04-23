import { describe, expect, it } from 'vitest'
import {
  findTaskColumn,
  getAllowedDropColumns,
  insertTaskAtDropLocation,
  reorderTasksInColumn,
  resolveDropLocation,
} from '../src/features/task-board/model/drag-utils'

function createTask(id) {
  return {
    id,
    title: `Task ${id}`,
    project: '/tmp/project',
    agent: 'codex',
    createdAt: '2026-04-23',
    mode: 'code',
    model: null,
    effort: 'medium',
    fastMode: false,
    taskType: null,
  }
}

function createTasks() {
  return {
    backlog: [createTask('b-1'), createTask('b-2')],
    todo: [createTask('t-1')],
    in_progress: [createTask('p-1')],
    done: [createTask('d-1')],
  }
}

describe('drag utils', () => {
  it('finds backlog cards as a real board column', () => {
    expect(findTaskColumn(createTasks(), 'b-2')).toBe('backlog')
  })

  it('resolves dropping on a column container to the end of that column', () => {
    expect(resolveDropLocation(createTasks(), 'done')).toEqual({
      column: 'done',
      index: 1,
    })
  })

  it('disallows dragging backlog items into completed', () => {
    expect(getAllowedDropColumns('backlog')).toEqual(['backlog', 'todo', 'in_progress'])
    expect(resolveDropLocation(createTasks(), 'done', getAllowedDropColumns('backlog'))).toBe(null)
  })

  it('moves backlog cards into todo at the requested position', () => {
    const nextTasks = insertTaskAtDropLocation(createTasks(), 'b-1', 'backlog', {
      column: 'todo',
      index: 0,
    })

    expect(nextTasks.backlog.map(task => task.id)).toEqual(['b-2'])
    expect(nextTasks.todo.map(task => task.id)).toEqual(['b-1', 't-1'])
  })

  it('supports moving board cards back into backlog', () => {
    const nextTasks = insertTaskAtDropLocation(createTasks(), 't-1', 'todo', {
      column: 'backlog',
      index: 1,
    })

    expect(nextTasks.todo).toHaveLength(0)
    expect(nextTasks.backlog.map(task => task.id)).toEqual(['b-1', 't-1', 'b-2'])
  })

  it('reorders tasks within a column', () => {
    const nextTasks = reorderTasksInColumn(createTasks(), 'backlog', 'b-2', 0)
    expect(nextTasks.backlog.map(task => task.id)).toEqual(['b-2', 'b-1'])
  })
})
