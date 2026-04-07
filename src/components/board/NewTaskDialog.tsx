import { Sparkle, Terminal, X } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { useBoard } from './store'
import { type Agent, COLUMNS, type ColumnId } from './types'

export function NewTaskDialog() {
  const { dialogOpen, dialogColumn, closeNewTask, addTask } = useBoard()

  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [tag, setTag] = useState('')
  const [agent, setAgent] = useState<Agent>('claude')
  const [column, setColumn] = useState<ColumnId>(dialogColumn)

  const titleRef = useRef<HTMLInputElement>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (dialogOpen) {
      setTitle('')
      setProject('')
      setTag('')
      setAgent('claude')
      setColumn(dialogColumn)
      // Focus title shortly after mount
      requestAnimationFrame(() => titleRef.current?.focus())
    }
  }, [dialogOpen, dialogColumn])

  // Esc to close
  useEffect(() => {
    if (!dialogOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeNewTask()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [dialogOpen, closeNewTask])

  if (!dialogOpen) return null

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      titleRef.current?.focus()
      return
    }
    addTask({ title, project, agent, tag, column })
    closeNewTask()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-task-title"
      className="fixed inset-0 z-[100] flex items-center justify-center"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={closeNewTask}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 bg-primary" />
            <span className="text-[0.6rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              compose · new task
            </span>
          </div>
          <button
            type="button"
            onClick={closeNewTask}
            className="flex size-6 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            aria-label="Close"
          >
            <X size={12} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 px-5 py-5">
          <div>
            <label
              htmlFor="task-title"
              className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
            >
              Task
            </label>
            <input
              id="task-title"
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="font-heading w-full border-b border-border bg-transparent pb-2 text-2xl leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="task-project"
                className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
              >
                Project
              </label>
              <input
                id="task-project"
                value={project}
                onChange={e => setProject(e.target.value)}
                placeholder="agent-todo/web"
                className="h-8 w-full border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="task-tag"
                className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
              >
                Tag <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="task-tag"
                value={tag}
                onChange={e => setTag(e.target.value)}
                placeholder="design, backend…"
                className="h-8 w-full border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-foreground focus:outline-none"
              />
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
                onSelect={setAgent}
                Icon={Sparkle}
                label="Claude"
              />
              <AgentChoice
                value="codex"
                current={agent}
                onSelect={setAgent}
                Icon={Terminal}
                label="Codex"
              />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Column
            </span>
            <div className="grid grid-cols-3 gap-2">
              {COLUMNS.map(col => {
                const active = column === col.id
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setColumn(col.id)}
                    className={[
                      'flex h-8 items-center justify-center border text-[0.62rem] font-medium tracking-[0.14em] uppercase transition-colors',
                      active
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {col.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
          <span className="flex items-center gap-1.5 text-[0.6rem] tracking-[0.14em] text-muted-foreground uppercase">
            <kbd className="border border-border bg-background px-1.5 py-0.5 text-[0.58rem] text-foreground normal-case">
              esc
            </kbd>
            to cancel
          </span>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={closeNewTask}>
              <span className="text-[0.68rem] tracking-[0.12em] uppercase">Cancel</span>
            </Button>
            <Button type="submit" size="sm" disabled={!title.trim()}>
              <span className="text-[0.68rem] tracking-[0.12em] uppercase">Create task</span>
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function AgentChoice({
  value,
  current,
  onSelect,
  Icon,
  label,
}: {
  value: Agent
  current: Agent
  onSelect: (a: Agent) => void
  Icon: React.ComponentType<{ size?: number; weight?: 'fill' | 'bold' | 'duotone' }>
  label: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={[
        'group/agent flex items-center gap-2 border px-3 py-2 text-left transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-foreground',
      ].join(' ')}
    >
      <span
        className={[
          'flex size-6 items-center justify-center border',
          active
            ? 'border-background bg-background text-foreground'
            : 'border-border bg-background text-foreground',
        ].join(' ')}
      >
        <Icon size={11} weight="fill" />
      </span>
      <span className="flex flex-col">
        <span className="text-[0.78rem] font-medium leading-tight">{label}</span>
        <span
          className={[
            'text-[0.56rem] tracking-[0.12em] uppercase',
            active ? 'text-background/70' : 'text-muted-foreground',
          ].join(' ')}
        >
          {value === 'claude' ? 'thoughtful · prose' : 'fast · code'}
        </span>
      </span>
    </button>
  )
}
