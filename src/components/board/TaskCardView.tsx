import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVertical, Folder, Sparkle, Terminal } from '@phosphor-icons/react'
import { useBoard } from './store'
import type { ColumnId, TaskCard } from './types'

type Props = {
  task: TaskCard
  column: ColumnId
  isOverlay?: boolean
}

const agentMeta = {
  claude: {
    label: 'Claude',
    Icon: Sparkle,
    className: 'text-primary-foreground bg-primary border-primary',
  },
  codex: {
    label: 'Codex',
    Icon: Terminal,
    className: 'text-foreground bg-background border-foreground',
  },
} as const

export function TaskCardView({ task, column, isOverlay = false }: Props) {
  const { openEditTask } = useBoard()
  const sortable = useSortable({
    id: task.id,
    data: { column, task },
  })

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  const agent = agentMeta[task.agent]
  const AgentIcon = agent.Icon
  const isDone = column === 'done'

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        'group/card relative flex flex-col border bg-card text-card-foreground transition-all',
        'border-border hover:border-foreground/40 hover:-translate-y-px',
        isDragging && !isOverlay ? 'opacity-30' : 'opacity-100',
        isOverlay
          ? 'rotate-[1.2deg] border-foreground shadow-[6px_6px_0_0_oklch(0.18_0.012_80/0.12)]'
          : '',
      ].join(' ')}
    >
      {/* Top: drag handle + agent pill */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="-ml-1 flex cursor-grab items-center gap-1 p-1 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag task"
        >
          <DotsSixVertical size={14} weight="bold" />
          <span className="text-[0.58rem] tracking-[0.14em] uppercase">
            {task.id.toUpperCase()}
          </span>
        </button>

        <span
          className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.58rem] font-medium tracking-[0.12em] uppercase ${agent.className}`}
        >
          <AgentIcon size={10} weight="fill" />
          {agent.label}
        </span>
      </div>

      {/* Body: clickable to edit */}
      <button
        type="button"
        onClick={() => !isDragging && openEditTask(task, column)}
        className="block w-full cursor-pointer text-left"
      >
        <div className="px-4 py-4">
          <h3
            className={[
              'font-heading text-[1.35rem] leading-[1.2] tracking-tight',
              isDone
                ? 'text-muted-foreground line-through decoration-foreground/40'
                : 'text-foreground',
            ].join(' ')}
          >
            {task.title}
          </h3>
        </div>

        {/* Footer: project + tag + date */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-border px-3 py-2">
          <span className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
            <Folder size={11} weight="duotone" />
            <span className="truncate">{task.project}</span>
          </span>
          <div className="flex items-center gap-2 text-[0.58rem] tracking-[0.1em] text-muted-foreground uppercase">
            {task.tag && (
              <span className="border border-border bg-muted px-1.5 py-0.5 text-foreground/80">
                {task.tag}
              </span>
            )}
            <span>{task.createdAt.slice(5)}</span>
          </div>
        </div>
      </button>

      {/* Decorative corner */}
      <span className="pointer-events-none absolute top-0 right-0 size-2 border-t-2 border-r-2 border-foreground/0 transition-colors group-hover/card:border-primary" />
    </article>
  )
}
