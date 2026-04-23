import { createFileRoute } from '@tanstack/react-router'
import { BoardShell } from '#/features/task-board/components/BoardShell'

export const Route = createFileRoute('/')({ component: BoardPage })

function BoardPage() {
  return <BoardShell />
}
