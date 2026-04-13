import {
  ArrowRightIcon,
  FolderIcon,
  PencilSimpleIcon,
  PlusIcon,
  ProhibitIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { AppTopBar } from '#/app/components/AppTopBar'
import type { TaskCard } from '#/entities/task/types'
import { getEffortLabel, getModelLabel } from '#/features/agent-config/model/model-config'
import {
  getTaskModeBadgeClassName,
  getTaskModeLabel,
} from '#/features/agent-config/model/task-config'
import {
  getTaskTypeBadgeClassName,
  getTaskTypeLabel,
} from '#/features/agent-config/model/task-type-config'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'
import { formatProjectPathLabel } from '#/shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/shared/ui/alert-dialog'
import { Button } from '#/shared/ui/button'
import { ClaudeIcon, OpenAIIcon } from '#/shared/ui/icons'

export const Route = createFileRoute('/backlogs')({ component: BacklogsPage })

const agentMeta = {
  claude: {
    Icon: ClaudeIcon,
    className: 'text-primary-foreground bg-primary border-primary',
  },
  codex: {
    Icon: OpenAIIcon,
    className: 'text-foreground bg-background border-foreground',
  },
} as const

const backlogSkeletonIds = [
  'backlog-skeleton-1',
  'backlog-skeleton-2',
  'backlog-skeleton-3',
  'backlog-skeleton-4',
] as const

function BacklogCardSkeleton() {
  return (
    <article className="self-start border border-border bg-card shadow-[4px_4px_0_0_oklch(0.18_0.012_80/0.06)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <div className="h-3 w-20 animate-pulse rounded-sm bg-muted" />
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-16 animate-pulse rounded-sm bg-muted" />
          <div className="h-5 w-28 animate-pulse rounded-sm bg-muted" />
        </div>
      </div>

      <div className="space-y-2 px-5 py-5">
        <div className="h-6 w-4/5 animate-pulse rounded-sm bg-muted" />
        <div className="h-6 w-3/5 animate-pulse rounded-sm bg-muted" />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border px-5 py-3">
        <div className="h-3 w-32 animate-pulse rounded-sm bg-muted" />
        <div className="h-3 w-14 animate-pulse rounded-sm bg-muted" />
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-background/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 animate-pulse rounded-sm bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded-sm bg-muted" />
        </div>
        <div className="h-8 w-28 animate-pulse rounded-sm bg-muted" />
      </div>
    </article>
  )
}

function BacklogsPage() {
  const { tasks, isLoading, updateTask, removeTask } = useBoardTasks()
  const { openEditTask, openNewTask } = useBoardDialogs()
  const [searchQuery, setSearchQuery] = useState('')
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null)

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

  async function moveToTodo(task: TaskCard) {
    setMovingTaskId(task.id)
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
          taskType: task.taskType,
        },
        'backlog',
        'todo'
      )
    } catch (error) {
      console.error('[backlog] move to todo failed', error)
    } finally {
      setMovingTaskId(current => (current === task.id ? null : current))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        addLabel="New backlog"
        backlogActive
        backlogCount={tasks.backlog.length}
        onAddTask={() => openNewTask('backlog')}
        searchPlaceholder="Search backlog…"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="bg-paper min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex w-full max-w-350 flex-col px-8 py-5">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
            <div className="space-y-1">
              <p className="text-[0.68rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Backlog
              </p>
              <h1 className="font-heading text-3xl tracking-tight text-foreground">
                Ideas not yet surfaced on the main board
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Capture rough ideas here, revisit them later, and move the ones worth shipping into
                Todo when they are ready for execution.
              </p>
            </div>

            <Button size="sm" onClick={() => openNewTask('backlog')}>
              <PlusIcon size={13} />
              <span className="text-xs">Create backlog item</span>
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              {backlogSkeletonIds.map(skeletonId => (
                <BacklogCardSkeleton key={skeletonId} />
              ))}
            </div>
          ) : tasks.backlog.length === 0 ? (
            <div className="mt-6 flex flex-col items-center justify-center border border-dashed border-border bg-card/50 px-6 py-16 text-center">
              <p className="font-heading text-2xl tracking-tight text-foreground">
                Nothing in backlog yet
              </p>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Use backlog for top-of-head ideas that should stay out of the main board until they
                are ready to become actionable tasks.
              </p>
              <Button className="mt-5" onClick={() => openNewTask('backlog')}>
                <PlusIcon size={13} />
                <span className="text-xs">Create backlog item</span>
              </Button>
            </div>
          ) : filteredBacklog.length === 0 ? (
            <div className="mt-6 flex items-center justify-center border border-dashed border-border bg-card/50 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">No backlog items match this search.</p>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              {filteredBacklog.map(task => {
                const agent = agentMeta[task.agent]
                const AgentIcon = agent.Icon
                const modelLabel = getModelLabel(task.agent, task.model)
                const effortLabel = getEffortLabel(task.effort)
                const modelSummary = `${modelLabel} (${effortLabel}${task.fastMode ? ', Fast' : ''})`
                const isProjectless = !task.project || task.project === 'untitled'
                const projectLabel = isProjectless
                  ? 'No project'
                  : formatProjectPathLabel(task.project)
                const taskType = task.taskType
                const taskTypeLabel = taskType ? getTaskTypeLabel(taskType) : null

                return (
                  <article
                    key={task.id}
                    className="group/card relative self-start border border-border bg-card shadow-[4px_4px_0_0_oklch(0.18_0.012_80/0.06)] transition-all hover:border-foreground/40 hover:-translate-y-px"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                      <p className="text-[0.62rem] tracking-[0.16em] text-muted-foreground uppercase">
                        {task.id}
                      </p>
                      <div className="flex max-w-72 flex-wrap items-center justify-end gap-1.5">
                        <span
                          className={`inline-flex shrink-0 items-center border px-1.5 py-0.75 text-[0.58rem] font-semibold tracking-[0.08em] uppercase ${getTaskModeBadgeClassName(task.mode)}`}
                        >
                          {getTaskModeLabel(task.mode)}
                        </span>
                        {taskType ? (
                          <span
                            className={`inline-flex shrink-0 items-center border px-1.5 py-0.75 text-[0.58rem] font-semibold tracking-[0.08em] uppercase ${getTaskTypeBadgeClassName(taskType)}`}
                            title={taskTypeLabel ?? undefined}
                          >
                            {taskTypeLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openEditTask(task, 'backlog')}
                      className="block w-full cursor-pointer text-left"
                    >
                      <div className="px-4 py-4">
                        <h2 className="font-heading text-lg leading-snug tracking-tight text-foreground">
                          {task.title}
                        </h2>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-dashed border-border px-4 py-2">
                        <span
                          className={[
                            'inline-flex min-w-0 items-center gap-1 text-[0.62rem]',
                            isProjectless
                              ? 'italic text-muted-foreground/50'
                              : 'text-muted-foreground',
                          ].join(' ')}
                          title={isProjectless ? 'No project assigned' : task.project}
                        >
                          {isProjectless ? (
                            <ProhibitIcon size={12} weight="bold" />
                          ) : (
                            <FolderIcon size={12} weight="duotone" />
                          )}
                          <span className="truncate">{projectLabel}</span>
                        </span>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-[0.58rem] tracking-widest text-muted-foreground uppercase">
                            {task.createdAt.slice(5)}
                          </span>
                          <span
                            className={`inline-flex min-w-0 max-w-36 items-center gap-1 border px-1 py-0.5 text-[0.54rem] font-medium ${agent.className}`}
                            title={modelSummary}
                          >
                            <span className="shrink-0">
                              <AgentIcon size={9} />
                            </span>
                            <span className="min-w-0 truncate leading-none tracking-[0.05em] uppercase">
                              {modelSummary}
                            </span>
                          </span>
                        </div>
                      </div>
                    </button>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border bg-background/60 px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={<Button type="button" variant="destructive" size="xs" />}
                          >
                            <TrashIcon size={13} />
                            Delete
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the task and all its run history. This
                                action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                size="sm"
                                onClick={() => removeTask(task.id, 'backlog')}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => openEditTask(task, 'backlog')}
                        >
                          <PencilSimpleIcon size={13} />
                          Edit
                        </Button>
                      </div>
                      <Button
                        size="xs"
                        onClick={() => void moveToTodo(task)}
                        disabled={movingTaskId === task.id}
                      >
                        <ArrowRightIcon size={13} />
                        Move to Todo
                      </Button>
                    </div>

                    <span className="pointer-events-none absolute top-0 right-0 size-2 border-t-2 border-r-2 border-foreground/0 transition-colors group-hover/card:border-primary" />
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
