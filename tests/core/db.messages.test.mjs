import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetFactoryCounters, runFactory, taskFactory } from '../helpers/factories.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

describe('messages db', () => {
  let harness

  beforeAll(() => {
    harness = bootstrapTestDatabase('messages-db')
  })

  afterAll(() => {
    harness.cleanup()
  })

  beforeEach(() => {
    harness.reset()
    resetFactoryCounters()
  })

  it('appendMessage increments seq monotonically per run', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-msg' }))
    const run = harness.runs.createRun(runFactory(task.id, { id: 'r-msg' }))

    const first = harness.messages.appendMessage(run.id, 'user', 'text', 'hello')
    const second = harness.messages.appendMessage(run.id, 'agent', 'text', 'world')

    expect(first).toBe(1)
    expect(second).toBe(2)
  })

  it('listMessages returns ordered rows and parsed meta', () => {
    const task = harness.tasks.createTask(taskFactory({ id: 't-msg' }))
    const run = harness.runs.createRun(runFactory(task.id, { id: 'r-msg' }))

    harness.messages.appendMessage(run.id, 'agent', 'text', 'commentary', {
      phase: 'commentary',
    })
    harness.messages.appendMessage(run.id, 'agent', 'text', 'final', {
      phase: 'final',
    })

    const rows = harness.messages.listMessages(run.id)

    expect(rows.map(row => row.seq)).toEqual([1, 2])
    expect(rows[0].meta).toEqual({ phase: 'commentary' })
    expect(rows[1].meta).toEqual({ phase: 'final' })
  })
})
