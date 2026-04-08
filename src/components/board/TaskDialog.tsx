import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, Check, Folder, FolderOpen, X } from '@phosphor-icons/react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { Button } from '#/components/ui/button'
import { useBoard } from './store'
import type { Agent, ColumnId, TaskCard } from './types'

type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  body: string
  at: string
}

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'm1',
    role: 'agent',
    body: 'Reading the repo and locating the relevant files…',
    at: '14:02',
  },
  {
    id: 'm2',
    role: 'agent',
    body: 'Found the entrypoint at `src/board/store.tsx`. Drafting the change.',
    at: '14:03',
  },
  {
    id: 'm3',
    role: 'user',
    body: 'Make sure you do not break the existing dnd reorder.',
    at: '14:04',
  },
  {
    id: 'm4',
    role: 'agent',
    body: 'Understood — I will keep the sortable contract intact and only touch the optimistic update path.',
    at: '14:04',
  },
]

const MOCK_DONE_CHAT: ChatMessage[] = [
  {
    id: 'd1',
    role: 'agent',
    body: 'Set up Biome with strict ruleset and wired the script in `package.json`.',
    at: 'Apr 03 · 11:14',
  },
  {
    id: 'd2',
    role: 'user',
    body: 'Looks good. Run a final type check.',
    at: 'Apr 03 · 11:18',
  },
  {
    id: 'd3',
    role: 'agent',
    body: 'tsc clean. All checks passing. Marking complete.',
    at: 'Apr 03 · 11:19',
  },
]

export function TaskDialog() {
  const {
    dialogOpen,
    closeNewTask,
    addTask,
    editingTask,
    editingColumn,
    closeEditTask,
    updateTask,
  } = useBoard()

  const isEdit = !!editingTask
  const isOpen = dialogOpen || isEdit
  const close = isEdit ? closeEditTask : closeNewTask

  // Esc to close + lock scroll
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  if (!isOpen) return null

  // Branch on editing column
  const mode: 'form' | 'chat' | 'readonly' =
    isEdit && editingColumn === 'in_progress'
      ? 'chat'
      : isEdit && editingColumn === 'done'
        ? 'readonly'
        : 'form'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
      />

      {mode === 'form' && (
        <FormPanel
          isEdit={isEdit}
          editingTask={editingTask}
          editingColumn={editingColumn}
          close={close}
          onCreate={input => {
            addTask(input)
            closeNewTask()
          }}
          onUpdate={(id, updates, col) => {
            updateTask(id, updates, col, col)
            closeEditTask()
          }}
        />
      )}

      {mode === 'chat' && editingTask && <ChatPanel task={editingTask} close={close} />}

      {mode === 'readonly' && editingTask && <ReadonlyPanel task={editingTask} close={close} />}
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Header (shared)                                                          */
/* ----------------------------------------------------------------------- */

function PanelHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-primary" />
        <span className="text-[0.6rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex size-6 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
        aria-label="Close"
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Form panel (new task + editing a TODO task)                              */
/* ----------------------------------------------------------------------- */

function FormPanel({
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
  onCreate: (input: { title: string; project: string; agent: Agent; column: ColumnId }) => void
  onUpdate: (
    id: string,
    updates: { title: string; project: string; agent: Agent },
    column: ColumnId
  ) => void
}) {
  const [title, setTitle] = useState(editingTask?.title ?? '')
  const [project, setProject] = useState(editingTask?.project ?? '')
  const [agent, setAgent] = useState<Agent>(editingTask?.agent ?? 'claude')
  const titleRef = useRef<HTMLTextAreaElement>(null)

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
      if (handle) setProject(handle.name)
    } catch {
      /* user cancelled */
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      titleRef.current?.focus()
      return
    }
    if (isEdit && editingTask && editingColumn) {
      onUpdate(editingTask.id, { title, project, agent }, editingColumn)
    } else {
      onCreate({ title, project, agent, column: 'todo' })
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] sm:max-h-[calc(100vh-3rem)]"
    >
      <PanelHeader
        label={isEdit ? `edit task · ${editingTask?.id ?? ''}` : 'new task'}
        onClose={close}
      />

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
            className="font-heading w-full resize-none overflow-hidden border-b border-border bg-transparent pb-2 text-2xl leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
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
              onSelect={setAgent}
              Icon={ClaudeIcon}
              label="Claude"
            />
            <AgentChoice
              value="codex"
              current={agent}
              onSelect={setAgent}
              Icon={OpenAIIcon}
              label="Codex"
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

/* ----------------------------------------------------------------------- */
/* Chat panel (in_progress)                                                 */
/* ----------------------------------------------------------------------- */

function ChatPanel({ task, close }: { task: TaskCard; close: () => void }) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_CHAT)
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length === 0) return
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  function send() {
    const body = draft.trim()
    if (!body) return
    setMessages(prev => [...prev, { id: `m-${Date.now()}`, role: 'user', body, at: 'now' }])
    setDraft('')
  }

  return (
    <section className="relative z-10 flex h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] sm:h-[calc(100vh-3rem)]">
      {/* Header: agent icon + truncated prompt, project on next line */}
      <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-5 shrink-0 items-center justify-center border border-border bg-background text-foreground"
              title={agentLabel}
            >
              <AgentIcon size={11} />
            </span>
            <p className="truncate text-sm font-medium leading-tight text-foreground">
              {task.title}
            </p>
          </div>
          <div className="mt-1.5 flex items-center pl-7">
            <span className="inline-flex max-w-full items-center gap-1.5 border border-border bg-muted px-2 py-0.5 text-[0.78rem] font-medium text-foreground">
              <Folder size={13} weight="duotone" />
              <span className="truncate">{task.project}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          aria-label="Close"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-background px-5 py-4">
        {messages.map(m => (
          <ChatBubble key={m.id} message={m} agentIcon={AgentIcon} />
        ))}
      </div>

      {/* Follow-up composer */}
      <div className="border-t border-border bg-card px-3 py-3">
        <div className="flex items-end gap-2 border border-border bg-background px-2 py-1.5 focus-within:border-foreground">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="Send a follow-up to the agent…"
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent px-1 text-sm leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim()}
            className="flex size-7 items-center justify-center border border-foreground bg-foreground text-background transition-opacity disabled:opacity-30"
            aria-label="Send"
          >
            <ArrowUp size={13} weight="bold" />
          </button>
        </div>
      </div>
    </section>
  )
}

function ChatBubble({
  message,
  agentIcon: AgentIcon,
}: {
  message: ChatMessage
  agentIcon: React.ComponentType<{ size?: number }>
}) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <span
        className={[
          'flex size-6 shrink-0 items-center justify-center border',
          isUser
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-card text-foreground',
        ].join(' ')}
      >
        {isUser ? (
          <span className="text-[0.55rem] font-bold tracking-wider">YOU</span>
        ) : (
          <AgentIcon size={11} />
        )}
      </span>
      <div
        className={`max-w-[80%] ${isUser ? 'items-end text-right' : 'items-start text-left'} flex flex-col`}
      >
        <div
          className={[
            'border px-3 py-2 text-sm leading-snug',
            isUser
              ? 'border-foreground bg-foreground text-background'
              : 'border-border bg-card text-foreground',
          ].join(' ')}
        >
          {message.body}
        </div>
        <span className="mt-1 text-[0.55rem] tracking-widest text-muted-foreground uppercase">
          {message.at}
        </span>
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------------- */
/* Readonly panel (done)                                                    */
/* ----------------------------------------------------------------------- */

function ReadonlyPanel({ task, close }: { task: TaskCard; close: () => void }) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'
  const transcript = useMemo(() => MOCK_DONE_CHAT, [])

  return (
    <section className="relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] sm:max-h-[calc(100vh-3rem)]">
      {/* Header: agent icon + truncated prompt, project on next line */}
      <div className="flex items-start justify-between gap-3 border-b border-border bg-card px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex size-5 shrink-0 items-center justify-center border border-border bg-background text-foreground"
              title={agentLabel}
            >
              <AgentIcon size={11} />
            </span>
            <p className="truncate text-sm font-medium leading-tight text-foreground">
              {task.title}
            </p>
            <span className="ml-1 inline-flex shrink-0 items-center gap-1 border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[0.55rem] font-medium tracking-[0.12em] text-primary uppercase">
              <Check size={9} weight="bold" />
              {task.createdAt}
            </span>
          </div>
          <div className="mt-1.5 flex items-center pl-7">
            <span className="inline-flex max-w-full items-center gap-1.5 border border-border bg-muted px-2 py-0.5 text-[0.78rem] font-medium text-foreground">
              <Folder size={13} weight="duotone" />
              <span className="truncate">{task.project}</span>
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={close}
          className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          aria-label="Close"
        >
          <X size={12} weight="bold" />
        </button>
      </div>

      <div className="overflow-y-auto">
        {/* Transcript */}
        <div className="space-y-3 px-5 py-4">
          <div className="mb-2 text-[0.58rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Transcript
          </div>
          {transcript.map(m => (
            <ChatBubble key={m.id} message={m} agentIcon={AgentIcon} />
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3">
        <Button type="button" size="sm" onClick={close}>
          <span className="text-[0.68rem] tracking-[0.12em] uppercase">Close</span>
        </Button>
      </div>
    </section>
  )
}

/* ----------------------------------------------------------------------- */
/* Agent choice                                                             */
/* ----------------------------------------------------------------------- */

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
      <span
        className={[
          'flex size-6 items-center justify-center border',
          active
            ? 'border-background bg-background text-foreground'
            : 'border-border bg-background text-foreground',
        ].join(' ')}
      >
        <Icon size={12} />
      </span>
      <span className="text-[0.78rem] font-medium leading-tight">{label}</span>
    </button>
  )
}
