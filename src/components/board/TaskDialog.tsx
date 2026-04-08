import { FolderOpen, X } from '@phosphor-icons/react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { useEffect, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { useBoard } from './store'
import { type Agent, COLUMNS, type ColumnId } from './types'

export function TaskDialog() {
  const {
    dialogOpen, dialogColumn, closeNewTask, addTask,
    editingTask, editingColumn, closeEditTask, updateTask,
  } = useBoard()

  const isEdit = !!editingTask
  const isOpen = dialogOpen || isEdit
  const close = isEdit ? closeEditTask : closeNewTask

  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [tag, setTag] = useState('')
  const [agent, setAgent] = useState<Agent>('claude')
  const [column, setColumn] = useState<ColumnId>('todo')

  const titleRef = useRef<HTMLTextAreaElement>(null)

  // Populate / reset form whenever the dialog opens
  useEffect(() => {
    if (!isOpen) return
    if (isEdit && editingTask && editingColumn) {
      setTitle(editingTask.title)
      setProject(editingTask.project)
      setTag(editingTask.tag ?? '')
      setAgent(editingTask.agent)
      setColumn(editingColumn)
    } else {
      setTitle('')
      setProject('')
      setTag('')
      setAgent('claude')
      setColumn(dialogColumn)
    }
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
  }, [isOpen, isEdit, editingTask, editingColumn, dialogColumn])

  // Esc to close + lock scroll
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  if (!isOpen) return null

  async function pickFolder() {
    try {
      const handle = await (window as Window & { showDirectoryPicker?: () => Promise<{ name: string }> }).showDirectoryPicker?.()
      if (handle) setProject(handle.name)
    } catch {
      // user cancelled
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { titleRef.current?.focus(); return }
    if (isEdit && editingTask && editingColumn) {
      updateTask(editingTask.id, { title, project, agent, tag }, editingColumn, column)
      closeEditTask()
    } else {
      addTask({ title, project, agent, tag, column })
      closeNewTask()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] sm:max-h-[calc(100vh-3rem)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="size-1.5 bg-primary" />
            <span className="text-[0.6rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              {isEdit ? `edit task · ${editingTask?.id ?? ''}` : 'new task'}
            </span>
          </div>
          <button
            type="button"
            onClick={close}
            className="flex size-6 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            aria-label="Close"
          >
            <X size={12} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 overflow-y-auto px-5 py-5">
          {/* Title */}
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
              className="font-heading w-full resize-none overflow-hidden border-b border-border bg-transparent pb-2 text-2xl leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
            />
          </div>

          {/* Project + Tag */}
          <div className="grid grid-cols-2 gap-4">
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

          {/* Agent */}
          <div>
            <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Assign to
            </span>
            <div className="grid grid-cols-2 gap-2">
              <AgentChoice value="claude" current={agent} onSelect={setAgent} Icon={ClaudeIcon} label="Claude" />
              <AgentChoice value="codex"  current={agent} onSelect={setAgent} Icon={OpenAIIcon} label="Codex"  />
            </div>
          </div>

          {/* Column */}
          <div>
            <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Column
            </span>
            <div className="grid grid-cols-3 gap-2">
              {COLUMNS.map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setColumn(col.id)}
                  className={[
                    'flex h-8 items-center justify-center border text-[0.62rem] font-medium tracking-[0.14em] uppercase transition-colors',
                    column === col.id
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground',
                  ].join(' ')}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
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
    </div>
  )
}

function AgentChoice({
  value, current, onSelect, Icon, label,
}: {
  value: Agent
  current: Agent
  onSelect: (a: Agent) => void
  Icon: React.ComponentType<{ size?: number }>
  label: string
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={[
        'flex items-center gap-2 border px-3 py-2 text-left transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground hover:border-foreground',
      ].join(' ')}
    >
      <span className={[
        'flex size-6 items-center justify-center border',
        active ? 'border-background bg-background text-foreground' : 'border-border bg-background text-foreground',
      ].join(' ')}>
        <Icon size={12} />
      </span>
      <span className="text-[0.78rem] font-medium leading-tight">{label}</span>
    </button>
  )
}
