import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DotsSixVerticalIcon, FolderIcon } from '@phosphor-icons/react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { useBoardDialogs } from '#/stores/board'
import type { ColumnId, TaskCard } from './types'

type Props = {
  task: TaskCard
  column: ColumnId
  isOverlay?: boolean
}

const agentMeta = {
  claude: {
    label: 'Claude',
    Icon: ClaudeIcon,
    className: 'text-primary-foreground bg-primary border-primary',
  },
  codex: {
    label: 'Codex',
    Icon: OpenAIIcon,
    className: 'text-foreground bg-background border-foreground',
  },
} as const

export function TaskCardView({ task, column, isOverlay = false }: Props) {
  const { openEditTask } = useBoardDialogs()
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
  const isInProgress = column === 'in_progress'
  // Working: agent is actively processing a turn (show pulsing indicator).
  // AwaitingFollowUp: agent finished the turn; card stays in-progress until the
  // user either sends a follow-up or manually moves the card to Completed.
  const isAgentWorking =
    isInProgress && !!task.runStatus && ['starting', 'running', 'active'].includes(task.runStatus)
  const isAwaitingFollowUp = isInProgress && task.runStatus === 'idle'

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={[
        'group/card relative flex flex-col border bg-card text-card-foreground transition-all',
        isAgentWorking
          ? 'border-primary/40 hover:border-primary/70 hover:-translate-y-px'
          : isAwaitingFollowUp
            ? 'border-emerald-500/40 hover:border-emerald-500/70 hover:-translate-y-px'
            : 'border-border hover:border-foreground/40 hover:-translate-y-px',
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
          <DotsSixVerticalIcon size={14} weight="bold" />
          <span className="text-[0.58rem] tracking-[0.14em] uppercase">
            {task.id.toUpperCase()}
          </span>
        </button>

        <span
          className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[0.58rem] font-medium tracking-[0.12em] uppercase ${agent.className}`}
        >
          <AgentIcon size={10} />
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
              'font-heading text-sm leading-snug tracking-tight line-clamp-3',
              isDone
                ? 'text-muted-foreground line-through decoration-foreground/40'
                : 'text-foreground',
            ].join(' ')}
          >
            {task.title}
          </h3>
        </div>

        {/* Footer: project + date */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-border px-3 py-2">
          <span className="flex items-center gap-1.5 text-[0.62rem] text-muted-foreground">
            <FolderIcon size={11} weight="duotone" />
            <span className="truncate">{task.project}</span>
          </span>
          <span className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">
            {task.createdAt.slice(5)}
          </span>
        </div>
      </button>

      {/* Agent status — left-edge indicator (sits inside the 1px border). */}
      {isAgentWorking && (
        <span className="pointer-events-none absolute inset-y-px left-px w-1 animate-pulse bg-primary" />
      )}
      {isAwaitingFollowUp && (
        <span className="pointer-events-none absolute inset-y-px left-px w-1 bg-emerald-500" />
      )}

      {/* Decorative corner */}
      <span className="pointer-events-none absolute top-0 right-0 size-2 border-t-2 border-r-2 border-foreground/0 transition-colors group-hover/card:border-primary" />
    </article>
  )
}
