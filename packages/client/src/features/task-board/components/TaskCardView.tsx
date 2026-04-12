import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArchiveIcon,
  CodeIcon,
  DotsSixVerticalIcon,
  FolderIcon,
  MagnifyingGlassIcon,
} from '@phosphor-icons/react'
import { useState } from 'react'
import type { ColumnId, TaskCard } from '#/entities/task/types'
import { getEffortLabel, getModelLabel } from '#/features/agent-config/model/model-config'
import {
  getTaskModeBadgeClassName,
  getTaskModeLabel,
} from '#/features/agent-config/model/task-config'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'
import { formatProjectPathLabel } from '#/shared/lib/utils'
import { ClaudeIcon, OpenAIIcon } from '#/shared/ui/icons'

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
  const { updateTask } = useBoardTasks()
  const [movingToBacklog, setMovingToBacklog] = useState(false)
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
  const modelLabel = getModelLabel(task.agent, task.model)
  const effortLabel = getEffortLabel(task.effort)
  const modelSummary = `${modelLabel} (${effortLabel}${task.fastMode ? ', Fast' : ''})`
  const projectLabel = formatProjectPathLabel(task.project)
  const modeLabel = getTaskModeLabel(task.mode)
  const ModeIcon = task.mode === 'code' ? CodeIcon : MagnifyingGlassIcon
  const isDone = column === 'done'
  const isInProgress = column === 'in_progress'
  // Working: agent is actively processing a turn (show pulsing indicator).
  // AwaitingFollowUp: agent finished the turn; card stays in-progress until the
  // user either sends a follow-up or manually moves the card to Completed.
  const isAgentWorking =
    isInProgress && !!task.runStatus && ['starting', 'running', 'active'].includes(task.runStatus)
  const isAwaitingFollowUp = isInProgress && task.runStatus === 'idle'

  async function moveToBacklog() {
    if (column !== 'todo' || isOverlay || movingToBacklog) return
    setMovingToBacklog(true)
    try {
      await updateTask(
        task.id,
        {
          title: task.title,
          project: task.project,
          agent: task.agent,
          mode: task.mode,
          model: task.model,
          effort: task.effort,
          fastMode: task.fastMode,
        },
        'todo',
        'backlog'
      )
    } catch (error) {
      console.error('[board] moveToBacklog failed', error)
    } finally {
      setMovingToBacklog(false)
    }
  }

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
      {/* Top: drag handle + task configuration */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
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

        <div className="flex max-w-56 items-center justify-end gap-1.5">
          <span
            className={`inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.75 text-[0.58rem] font-semibold tracking-[0.08em] uppercase ${getTaskModeBadgeClassName(task.mode)}`}
            title={`${modeLabel} mode`}
          >
            <ModeIcon size={9} weight="bold" />
            <span className="leading-none">{modeLabel}</span>
          </span>
          <span
            className={`inline-flex min-w-0 max-w-42 items-center gap-1.5 border px-1.5 py-0.75 text-[0.58rem] font-medium ${agent.className}`}
            title={modelSummary}
          >
            <span className="shrink-0">
              <AgentIcon size={10} />
            </span>
            <span className="min-w-0 truncate leading-none tracking-[0.06em] uppercase">
              {modelSummary}
            </span>
          </span>
        </div>
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
      </button>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-dashed border-border px-3 py-2">
        <span
          className="flex min-w-0 items-center gap-1.5 text-[0.62rem] text-muted-foreground"
          title={task.project}
        >
          <FolderIcon size={11} weight="duotone" />
          <span className="truncate">{projectLabel}</span>
        </span>
        <div className="flex items-center gap-2">
          {column === 'todo' && !isOverlay ? (
            <button
              type="button"
              onClick={() => void moveToBacklog()}
              disabled={movingToBacklog}
              className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-1 text-[0.58rem] tracking-[0.1em] text-muted-foreground uppercase transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
            >
              <ArchiveIcon size={10} weight="bold" />
              <span>Backlog</span>
            </button>
          ) : null}
          <span className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">
            {task.createdAt.slice(5)}
          </span>
        </div>
      </div>

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
