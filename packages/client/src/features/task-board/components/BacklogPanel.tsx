import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArchiveIcon, MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { useMemo, useState } from 'react'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'
import { Button } from '#/shared/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '#/shared/ui/sheet'
import { TaskCardView } from './TaskCardView'

type BacklogPanelProps = {
  isDropTarget?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BacklogPanel({ isDropTarget = false, open, onOpenChange }: BacklogPanelProps) {
  const { tasks, isLoading } = useBoardTasks()
  const { dialogOpen, editingTask, openCreateBacklogDialog } = useBoardDialogs()
  const [searchQuery, setSearchQuery] = useState('')
  const { setNodeRef } = useDroppable({
    id: 'backlog',
    data: { column: 'backlog' },
  })
  const isTaskDialogOpen = dialogOpen || !!editingTask

  const filteredBacklog = useMemo(() => {
    if (!searchQuery.trim()) return tasks.backlog
    const query = searchQuery.toLowerCase()
    return tasks.backlog.filter(
      task =>
        task.title.toLowerCase().includes(query) ||
        task.id.toLowerCase().includes(query) ||
        task.project.toLowerCase().includes(query)
    )
  }, [searchQuery, tasks.backlog])

  return (
    <Sheet
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen && isTaskDialogOpen) return
        onOpenChange(nextOpen)
      }}
      modal={false}
      disablePointerDismissal
    >
      <SheetContent
        side="right"
        showOverlay={false}
        initialFocus={false}
        className="w-[24rem] border-border bg-background sm:max-w-[24rem]"
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <SheetHeader className="gap-3 border-b border-border">
            <div className="space-y-1">
              <SheetTitle>Backlog</SheetTitle>
              <SheetDescription>
                Keep rough ideas close by and drag them into the board when they are ready.
              </SheetDescription>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex h-8 min-w-0 w-full items-center gap-2 border border-border bg-card px-2.5 text-muted-foreground focus-within:border-foreground/60 focus-within:bg-background">
                <MagnifyingGlassIcon size={13} weight="regular" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search backlog…"
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label="Clear backlog search"
                  >
                    <XIcon size={12} weight="bold" />
                  </button>
                ) : null}
              </div>

              <Button
                size="sm"
                className="shrink-0 justify-self-end whitespace-nowrap"
                onClick={() => openCreateBacklogDialog()}
              >
                <PlusIcon data-icon="inline-start" />
                <span>Add Backlog</span>
              </Button>
            </div>
          </SheetHeader>

          <div
            ref={setNodeRef}
            className={[
              'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 transition-colors',
              isDropTarget ? 'bg-card/30' : '',
            ].join(' ')}
          >
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {['backlog-skeleton-1', 'backlog-skeleton-2', 'backlog-skeleton-3'].map(id => (
                  <div key={id} className="flex flex-col border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
                      <div className="h-3 w-16 animate-pulse rounded-sm bg-muted" />
                      <div className="h-4 w-12 animate-pulse rounded-sm bg-muted" />
                    </div>
                    <div className="space-y-2 px-4 py-4">
                      <div className="h-3.5 w-full animate-pulse rounded-sm bg-muted" />
                      <div className="h-3.5 w-4/5 animate-pulse rounded-sm bg-muted" />
                      <div className="h-3.5 w-3/5 animate-pulse rounded-sm bg-muted" />
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-dashed border-border px-3 py-2">
                      <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded-sm bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            ) : tasks.backlog.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center border border-dashed border-border bg-card/50 px-5 py-10 text-center">
                <ArchiveIcon size={18} weight="duotone" className="text-muted-foreground" />
                <p className="mt-3 font-heading text-xl tracking-tight text-foreground">
                  Nothing in backlog yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Capture rough work here before it becomes an active task.
                </p>
                <Button className="mt-5" onClick={() => openCreateBacklogDialog()}>
                  <PlusIcon data-icon="inline-start" />
                  <span>Add Backlog</span>
                </Button>
              </div>
            ) : filteredBacklog.length === 0 ? (
              <div className="flex flex-1 items-center justify-center border border-dashed border-border bg-card/50 px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">No backlog items match this search.</p>
              </div>
            ) : (
              <SortableContext
                items={filteredBacklog.map(task => task.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredBacklog.map(task => (
                  <TaskCardView key={task.id} task={task} column="backlog" />
                ))}
              </SortableContext>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
