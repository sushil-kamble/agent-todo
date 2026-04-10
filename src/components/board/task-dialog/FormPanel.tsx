import { CaretDown, Code, FolderOpen, MagnifyingGlass } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { Button } from '#/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import type { Subscriptions } from '#/lib/api'
import * as api from '#/lib/api'
import type { Agent, ColumnId, EffortLevel, TaskCard, TaskMode } from '../types'
import {
  getModelConfig,
  getEffortOptions,
  getModelLabel,
  MODELS_BY_AGENT,
  sanitizeEffort,
} from './model-config'
import { PanelHeader } from './shared'

export function FormPanel({
  isEdit,
  editingTask,
  editingColumn,
  close,
  onCreate,
  onUpdate,
}: {
  isEdit: boolean
  editingTask: TaskCard | null
  editingColumn: ColumnId | null
  close: () => void
  onCreate: (input: {
    title: string
    project: string
    agent: Agent
    column: ColumnId
    mode: TaskMode
    model: string | null
    effort: EffortLevel
  }) => void
  onUpdate: (
    id: string,
    updates: {
      title: string
      project: string
      agent: Agent
      mode: TaskMode
      model: string | null
      effort: EffortLevel
    },
    column: ColumnId
  ) => void
}) {
  const [title, setTitle] = useState(editingTask?.title ?? '')
  const [project, setProject] = useState(editingTask?.project ?? '')
  const [agent, setAgent] = useState<Agent>(editingTask?.agent ?? 'claude')
  const [mode, setMode] = useState<TaskMode>(editingTask?.mode ?? 'code')
  const [model, setModel] = useState<string | null>(editingTask?.model ?? null)
  const [effort, setEffort] = useState<EffortLevel>(editingTask?.effort ?? 'medium')
  const [subs, setSubs] = useState<Subscriptions | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    api.fetchSubscriptions().then(setSubs)
  }, [])

  // Auto-select the first available agent when subscription data arrives
  useEffect(() => {
    if (!subs) return
    if (!subs[agent]?.installed) {
      const other: Agent = agent === 'claude' ? 'codex' : 'claude'
      if (subs[other]?.installed) {
        setAgent(other)
        setModel(null)
      }
    }
  }, [subs, agent])

  useEffect(() => {
    setEffort(current => sanitizeEffort(agent, model, current))
  }, [agent, model])

  function handleAgentChange(next: Agent) {
    setAgent(next)
    // Reset model when switching agents — models are agent-specific
    setModel(null)
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      if (isEdit) {
        el.setSelectionRange(el.value.length, el.value.length)
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    })
  }, [isEdit])

  async function pickFolder() {
    try {
      const handle = await (
        window as Window & {
          showDirectoryPicker?: () => Promise<{ name: string }>
        }
      ).showDirectoryPicker?.()
      if (!handle) return
      setProject(await api.resolveDirectoryPath(handle.name))
    } catch {
      // user cancelled
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      titleRef.current?.focus()
      return
    }
    if (isEdit && editingTask && editingColumn) {
      onUpdate(editingTask.id, { title, project, agent, mode, model, effort }, editingColumn)
      return
    }
    onCreate({ title, project, agent, column: 'todo', mode, model, effort })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:max-h-[calc(100vh-3rem)]"
    >
      <PanelHeader label={title.trim() || (isEdit ? 'Edit task' : 'New task')} onClose={close} />

      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <label
            htmlFor="task-title"
            className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
          >
            Task
          </label>
          <textarea
            id="task-title"
            ref={titleRef}
            value={title}
            rows={3}
            onChange={e => {
              setTitle(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Describe exactly what needs to be done…"
            className="font-heading w-full resize-none overflow-hidden border-b border-border bg-transparent pb-2 text-base leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="task-project"
            className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
          >
            Project
          </label>
          <div className="flex h-8 items-stretch border border-border bg-card focus-within:border-foreground">
            <input
              id="task-project"
              value={project}
              onChange={e => setProject(e.target.value)}
              placeholder="Select or type a path…"
              className="min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="button"
              title="Browse folder"
              onClick={pickFolder}
              className="flex items-center border-l border-border px-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <FolderOpen size={13} />
            </button>
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Assign to
          </span>
          <div className="grid grid-cols-2 gap-2">
            <AgentChoice
              value="claude"
              current={agent}
              onSelect={handleAgentChange}
              label="Claude"
              disabled={subs !== null && !subs.claude.installed}
              plan={subs?.claude.plan ?? undefined}
            />
            <AgentChoice
              value="codex"
              current={agent}
              onSelect={handleAgentChange}
              label="Codex"
              disabled={subs !== null && !subs.codex.installed}
              plan={subs?.codex.plan ?? undefined}
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Configuration
          </span>
          <div className="grid grid-cols-2 gap-2">
            <ModePicker value={mode} onChange={setMode} />
            <ModelEffortPicker
              agent={agent}
              model={model}
              effort={effort}
              onModelChange={setModel}
              onEffortChange={setEffort}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <div className="ml-auto flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={close}>
            <span className="text-[0.68rem] tracking-[0.12em] uppercase">Cancel</span>
          </Button>
          <Button type="submit" size="sm" disabled={!title.trim()}>
            <span className="text-[0.68rem] tracking-[0.12em] uppercase">
              {isEdit ? 'Save changes' : 'Create task'}
            </span>
          </Button>
        </div>
      </div>
    </form>
  )
}

function ModePicker({ value, onChange }: { value: TaskMode; onChange: (m: TaskMode) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-foreground focus:border-foreground focus:outline-none">
        <span className="flex items-center gap-2">
          {value === 'code' ? (
            <Code size={14} weight="bold" />
          ) : (
            <MagnifyingGlass size={14} weight="bold" />
          )}
          <span className="font-medium">{value === 'code' ? 'Code' : 'Ask'}</span>
        </span>
        <CaretDown size={12} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as TaskMode)}>
            <DropdownMenuRadioItem value="code">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Code</span>
                <span className="text-[0.65rem] text-muted-foreground">
                  Edits files with full permissions
                </span>
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="ask">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Ask</span>
                <span className="text-[0.65rem] text-muted-foreground">
                  Read-only analysis, no file edits
                </span>
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ModelEffortPicker({
  agent,
  model,
  effort,
  onModelChange,
  onEffortChange,
}: {
  agent: Agent
  model: string | null
  effort: EffortLevel
  onModelChange: (m: string | null) => void
  onEffortChange: (e: EffortLevel) => void
}) {
  const models = MODELS_BY_AGENT[agent]
  const currentModelSlug = getModelConfig(agent, model).slug
  const effortOptions = getEffortOptions(agent, model)
  const summaryLabel = `${getModelLabel(agent, model)} (${effort})`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-1 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-foreground focus:border-foreground focus:outline-none">
        <span className="min-w-0 truncate font-medium">{summaryLabel}</span>
        <CaretDown size={12} className="shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={currentModelSlug}
            onValueChange={v => {
              const nextModel = v === models.find(m => m.isDefault)?.slug ? null : v
              onModelChange(nextModel)
              onEffortChange(sanitizeEffort(agent, nextModel, effort))
            }}
          >
            {models.map(m => (
              <DropdownMenuRadioItem key={m.slug} value={m.slug}>
                {m.label}
                {m.isDefault ? ' (default)' : ''}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Thinking Effort</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={sanitizeEffort(agent, model, effort)}
            onValueChange={v => onEffortChange(sanitizeEffort(agent, model, v as EffortLevel))}
          >
            {effortOptions.map(e => (
              <DropdownMenuRadioItem key={e.value} value={e.value}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">
                    {e.label}
                    {e.isDefault ? ' (default)' : ''}
                  </span>
                  <span className="text-[0.65rem] text-muted-foreground">{e.description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function planLabel(plan: string): string {
  const labels: Record<string, string> = {
    pro: 'Pro',
    max: 'Max',
    plus: 'Plus',
    free: 'Free',
  }
  const base = plan.split('_')[0]
  const suffix = plan.includes('_') ? ` ${plan.split('_')[1]}` : ''
  return (labels[base] ?? plan) + suffix
}

function AgentChoice({
  value,
  current,
  onSelect,
  label,
  disabled,
  plan,
}: {
  value: Agent
  current: Agent
  onSelect: (a: Agent) => void
  label: string
  disabled?: boolean
  plan?: string
}) {
  const active = current === value
  const Icon = value === 'claude' ? ClaudeIcon : OpenAIIcon

  const buttonElem = (
    <button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      aria-pressed={active}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-2 border px-3 py-2 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-card text-muted-foreground/40'
          : active
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-card text-foreground hover:border-foreground',
      ].join(' ')}
    >
      <span
        className={[
          'flex size-6 items-center justify-center border',
          disabled
            ? 'border-border/50 bg-background text-muted-foreground/40'
            : active
              ? 'border-background bg-background text-foreground'
              : 'border-border bg-background text-foreground',
        ].join(' ')}
      >
        <Icon size={12} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[0.78rem] font-medium leading-tight">{label}</span>
        {disabled && (
          <span className="text-[0.6rem] leading-none text-muted-foreground/60">
            Unavailable
          </span>
        )}
        {!disabled && plan && (
          <span className="text-[0.6rem] leading-none text-muted-foreground">
            {planLabel(plan)}
          </span>
        )}
      </span>
    </button>
  )

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="flex w-full" />}>
          {buttonElem}
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8}>
          <div className="flex max-w-56 flex-col gap-1">
            <p className="font-medium">Claude is unavailable</p>
            <p className="text-xs text-background/80">
              Configure Claude and make sure credits are available to assign tasks to it.
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  return buttonElem
}
