import { createFileRoute } from '@tanstack/react-router'
import { AppTopBar } from '#/app/components/AppTopBar'
import { Board } from '#/features/task-board/components/Board'
import {
  useBoardDialogs,
  useBoardSearch,
  useBoardTasks,
} from '#/features/task-board/model/provider'

export const Route = createFileRoute('/')({ component: BoardPage })

function BoardPage() {
  const { openNewTask } = useBoardDialogs()
  const { tasks } = useBoardTasks()
  const { searchQuery, setSearchQuery } = useBoardSearch()

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        addLabel="Add task"
        backlogCount={tasks.backlog.length}
        onAddTask={() => openNewTask('todo')}
        searchPlaceholder="Search tasks…"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="bg-paper min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex h-full w-full max-w-350 flex-col px-8 py-5">
          <Board />
        </div>
      </div>
    </div>
  )
}
