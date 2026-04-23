import { useEffect, useState } from 'react'
import { AppTopBar } from '#/app/components/AppTopBar'
import {
  resolveBoardShortcutAction,
  useBoardDialogs,
  useBoardSearch,
  useBoardTasks,
} from '#/features/task-board/model/provider'
import { Board } from './Board'

export function BoardShell() {
  const { openCreateTaskDialog } = useBoardDialogs()
  const { tasks } = useBoardTasks()
  const { searchQuery, setSearchQuery } = useBoardSearch()
  const [backlogOpen, setBacklogOpen] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (resolveBoardShortcutAction(event) !== 'backlog-panel') return
      event.preventDefault()
      setBacklogOpen(current => !current)
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        addLabel="Add task"
        backlogCount={tasks.backlog.length}
        onAddTask={() => openCreateTaskDialog()}
        onOpenBacklog={() => setBacklogOpen(current => !current)}
        searchPlaceholder="Search tasks…"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="bg-paper min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex h-full w-full max-w-350 flex-col px-8 py-5">
          <Board backlogOpen={backlogOpen} onBacklogOpenChange={setBacklogOpen} />
        </div>
      </div>
    </div>
  )
}
