import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ArrowDownIcon, PlusIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Column, TaskCard } from '#/entities/task/types'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'
import { TaskCardView } from './TaskCardView'

type Props = {
  column: Column
  tasks: TaskCard[]
  index: number
  isDropTarget?: boolean
}

const accent: Record<string, string> = {
  todo: 'bg-foreground',
  in_progress: 'bg-primary',
  done: 'bg-muted-foreground',
}

// Hand-crafted shimmer that mirrors TaskCardView's DOM structure.
// Shown as fallback until boneyard captures and generates real bones.
function TaskCardSkeleton() {
  return (
    <div className="flex flex-col border border-border bg-card">
      {/* Top: drag handle row */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="h-3 w-16 animate-pulse rounded-sm bg-muted" />
        <div className="h-4 w-12 animate-pulse rounded-sm bg-muted" />
      </div>
      {/* Body */}
      <div className="space-y-2 px-4 py-4">
        <div className="h-3.5 w-full animate-pulse rounded-sm bg-muted" />
        <div className="h-3.5 w-4/5 animate-pulse rounded-sm bg-muted" />
        <div className="h-3.5 w-3/5 animate-pulse rounded-sm bg-muted" />
      </div>
      {/* Footer */}
      <div className="mt-auto flex items-center justify-between border-t border-dashed border-border px-3 py-2">
        <div className="h-3 w-24 animate-pulse rounded-sm bg-muted" />
        <div className="h-3 w-10 animate-pulse rounded-sm bg-muted" />
      </div>
    </div>
  )
}

const SCROLL_BOTTOM_OFFSET = 80

export function BoardColumn({ column, tasks, index, isDropTarget = false }: Props) {
  const { openNewTask } = useBoardDialogs()
  const { isLoading } = useBoardTasks()
  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { column: column.id },
  })

  // Separate ref for scroll-position tracking (dnd setNodeRef is a callback ref).
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const isInProgress = column.id === 'in_progress'
  const canAddTask = column.id === 'todo'

  const combinedRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node)
      scrollRef.current = node
    },
    [setNodeRef]
  )

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const check = () => {
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_BOTTOM_OFFSET
      setShowScrollBtn(isInProgress && el.scrollHeight > el.clientHeight && !atBottom)
    }

    // Recompute whenever the rendered task list changes. The initial mount often
    // happens before the final column height/content settles, so a one-time
    // check can leave the button permanently hidden.
    check()
    el.addEventListener('scroll', check, { passive: true })

    // Re-check when the scroll container itself resizes or its children change.
    const ro = new ResizeObserver(check)
    ro.observe(el)
    const mo = new MutationObserver(check)
    mo.observe(el, { childList: true, subtree: true, characterData: true })

    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
      mo.disconnect()
    }
  }, [isInProgress])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }

  return (
    <section
      className={[
        'flex min-h-0 flex-col border border-border bg-card/40 backdrop-blur-[2px]',
        'transition-colors',
        isDropTarget ? 'border-foreground bg-card' : '',
      ].join(' ')}
    >
      {/* Column header */}
      <header className="flex items-center justify-between border-b border-border bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className={`size-2 ${accent[column.id]}`} />
          <span className="text-[0.62rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h2 className="font-heading text-xl leading-none text-foreground">{column.label}</h2>
          <span className="ml-1 border border-border bg-background px-1.5 text-[0.6rem] font-medium text-muted-foreground tabular-nums">
            {isLoading ? '–' : tasks.length}
          </span>
        </div>
        {canAddTask ? (
          <button
            type="button"
            onClick={() => openNewTask(column.id)}
            className="flex size-6 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            aria-label={`Add task to ${column.label}`}
          >
            <PlusIcon size={12} weight="bold" />
          </button>
        ) : null}
      </header>

      {/* Cards */}
      <div
        ref={combinedRef}
        className="relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3"
      >
        {isLoading ? (
          <TaskCardSkeleton />
        ) : (
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskCardView key={task.id} task={task} column={column.id} />
            ))}
          </SortableContext>
        )}

        {!isLoading && tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center border border-dashed border-border/70 p-6 text-center">
            <p className="font-heading text-sm italic text-muted-foreground">drop a task here</p>
          </div>
        )}

        {/* Ghost add affordance */}
        {canAddTask ? (
          <button
            type="button"
            onClick={() => openNewTask(column.id)}
            className="group/add mt-1 flex items-center justify-center gap-1.5 border border-dashed border-border bg-transparent py-2.5 text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:border-foreground hover:text-foreground"
          >
            <PlusIcon size={11} weight="bold" />
            add task
          </button>
        ) : null}

        {/* Scroll-to-bottom button — visible only when content is above the fold */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            className={[
              'sticky bottom-0 left-1/2 z-10 mx-auto flex -translate-x-px items-center justify-center',
              'size-7 border bg-background/90 backdrop-blur-sm',
              'transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0',
              isInProgress
                ? 'border-primary/40 text-primary hover:border-primary hover:bg-primary hover:text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
            ].join(' ')}
          >
            <ArrowDownIcon size={13} weight="bold" />
          </button>
        )}
      </div>
    </section>
  )
}
