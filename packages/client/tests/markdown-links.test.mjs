import { describe, expect, it } from 'vitest'
import { rewriteFileHref } from '../src/features/run-console/model/markdown'

describe('rewriteFileHref', () => {
  it('rewrites absolute file paths into VS Code links', () => {
    expect(
      rewriteFileHref(
        '/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx'
      )
    ).toBe(
      'vscode://file/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx'
    )
  })

  it('keeps inline line numbers from the pathname', () => {
    expect(
      rewriteFileHref(
        '/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255'
      )
    ).toBe(
      'vscode://file/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255'
    )
  })

  it('keeps inline line and column numbers from the pathname', () => {
    expect(
      rewriteFileHref(
        '/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255:7'
      )
    ).toBe(
      'vscode://file/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255:7'
    )
  })

  it('also rewrites localhost-relative links that already include the dev origin', () => {
    expect(
      rewriteFileHref(
        'http://localhost:3000/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255'
      )
    ).toBe(
      'vscode://file/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255'
    )
  })

  it('preserves hash-based line references', () => {
    expect(
      rewriteFileHref(
        '/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx#L255'
      )
    ).toBe(
      'vscode://file/Users/sushil/Projects/one-percent/agent-todo/packages/client/src/features/task-board/components/TaskCardView.tsx:255'
    )
  })

  it('ignores non-local links', () => {
    expect(rewriteFileHref('https://example.com/foo.tsx:255')).toBeNull()
  })
})
