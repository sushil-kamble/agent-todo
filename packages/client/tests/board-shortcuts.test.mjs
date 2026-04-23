import { describe, expect, it } from 'vitest'
import { resolveBoardShortcutAction } from '../src/features/task-board/model/provider'

function createKeyboardEventInput({
  key,
  tagName = 'DIV',
  isContentEditable = false,
  metaKey = false,
  ctrlKey = false,
  altKey = false,
} = {}) {
  return {
    key,
    metaKey,
    ctrlKey,
    altKey,
    target: {
      tagName,
      isContentEditable,
    },
  }
}

describe('board shortcuts', () => {
  it('maps N to the task create dialog', () => {
    expect(resolveBoardShortcutAction(createKeyboardEventInput({ key: 'n' }))).toBe('task')
  })

  it('maps B to opening the backlog sidebar', () => {
    expect(resolveBoardShortcutAction(createKeyboardEventInput({ key: 'b' }))).toBe('backlog-panel')
  })

  it('ignores shortcuts while typing in text inputs', () => {
    expect(
      resolveBoardShortcutAction(createKeyboardEventInput({ key: 'b', tagName: 'INPUT' }))
    ).toBe(null)
  })

  it('ignores shortcuts with modifier keys', () => {
    expect(resolveBoardShortcutAction(createKeyboardEventInput({ key: 'b', metaKey: true }))).toBe(
      null
    )
  })
})
