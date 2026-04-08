import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Plus } from '@phosphor-icons/react'
import { useBoard } from './store'
import { TaskCardView } from './TaskCardView'
import type { Column, TaskCard } from './types'

type Props = {
  column: Column
  tasks: TaskCard[]
  index: number
}

const accent: Record<string, string> = {
  todo: 'bg-foreground',
  in_progress: 'bg-primary',
  done: 'bg-muted-foreground',
}

export function BoardColumn({ column, tasks, index }: Props) {
  const { openNewTask } = useBoard()
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { column: column.id },
  })

  return (
    <section
      className={[
        'flex min-h-0 flex-col border border-border bg-card/40 backdrop-blur-[2px]',
        'transition-colors',
        isOver ? 'border-foreground bg-card' : '',
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
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => openNewTask(column.id)}
          className="flex size-6 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          aria-label={`Add task to ${column.label}`}
        >
          <Plus size={12} weight="bold" />
        </button>
      </header>

      {/* Cards */}
      <div ref={setNodeRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCardView key={task.id} task={task} column={column.id} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center border border-dashed border-border/70 p-6 text-center">
            <p className="font-heading text-sm italic text-muted-foreground">drop a task here</p>
          </div>
        )}

        {/* Ghost add affordance */}
        <button
          type="button"
          onClick={() => openNewTask(column.id)}
          className="group/add mt-1 flex items-center justify-center gap-1.5 border border-dashed border-border bg-transparent py-2.5 text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase transition-colors hover:border-foreground hover:text-foreground"
        >
          <Plus size={11} weight="bold" />
          add task
        </button>
      </div>
    </section>
  )
}
