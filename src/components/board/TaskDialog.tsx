import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowUp,
  CaretRight,
  Check,
  CopySimple,
  Folder,
  FolderOpen,
  X,
} from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { Button } from '#/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import * as api from '#/lib/api'
import type { AgentPhase } from '#/lib/api'
import { useBoard } from './store'
import type { Agent, ColumnId, TaskCard } from './types'

// Rewrite links that point at local source files (e.g.
// `/Users/foo/Projects/one-percent/1cc/README.md#L1` or the same path resolved
// against the dev origin like `http://localhost:3000/Users/.../README.md#L1`)
// into a `vscode://file/...:line` URI so clicking opens the file in VS Code at
// the referenced line instead of 404-ing against the dev server.
function rewriteFileHref(href: string | undefined): string | null {
  if (!href) return null
  let pathname: string
  let hash = ''
  try {
    const u = new URL(href, 'http://localhost')
    // Only rewrite same-origin / absolute-path style links — leave real external URLs alone.
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.hostname && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') return null
    pathname = u.pathname
    hash = u.hash
  } catch {
    return null
  }
  if (!pathname.startsWith('/')) return null
  // Heuristic: must look like an actual filesystem path to a file (has an extension).
  if (!/\.[A-Za-z0-9]+$/.test(pathname)) return null
  const lineMatch = hash.match(/^#L(\d+)(?:[-:](\d+))?/)
  const line = lineMatch ? lineMatch[1] : null
  const col = lineMatch?.[2] ?? null
  let uri = `vscode://file${pathname}`
  if (line) uri += `:${line}${col ? `:${col}` : ''}`
  return uri
}

// Markdown renderer tuned to the app's design tokens. We avoid pulling in
// @tailwindcss/typography's `prose` classes (Tailwind v4 plugin wiring is
// non-trivial) and instead map each element to our existing style system.
const MD_COMPONENTS = {
  p: (props: React.ComponentProps<'p'>) => (
    <p className="my-1.5 first:mt-0 last:mb-0 leading-snug" {...props} />
  ),
  strong: (props: React.ComponentProps<'strong'>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  em: (props: React.ComponentProps<'em'>) => <em className="italic" {...props} />,
  a: ({ href, ...props }: React.ComponentProps<'a'>) => {
    const rewritten = rewriteFileHref(href)
    return (
      <a
        className="underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground break-all"
        target={rewritten ? undefined : '_blank'}
        rel="noreferrer noopener"
        href={rewritten ?? href}
        {...props}
      />
    )
  },
  ul: (props: React.ComponentProps<'ul'>) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted-foreground" {...props} />
  ),
  ol: (props: React.ComponentProps<'ol'>) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-muted-foreground" {...props} />
  ),
  li: (props: React.ComponentProps<'li'>) => <li className="leading-snug" {...props} />,
  h1: (props: React.ComponentProps<'h1'>) => (
    <h1
      className="font-heading mt-3 mb-1.5 text-[0.9rem] leading-tight tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h2: (props: React.ComponentProps<'h2'>) => (
    <h2
      className="font-heading mt-3 mb-1.5 text-[0.82rem] leading-tight tracking-tight text-foreground first:mt-0"
      {...props}
    />
  ),
  h3: (props: React.ComponentProps<'h3'>) => (
    <h3
      className="mt-2.5 mb-1 text-[0.82rem] font-semibold tracking-[0.02em] text-foreground uppercase first:mt-0"
      {...props}
    />
  ),
  code: ({
    inline,
    className,
    children,
    ...rest
  }: React.ComponentProps<'code'> & { inline?: boolean }) => {
    if (inline === false) {
      return (
        <code className={`font-mono text-[0.78rem] ${className ?? ''}`} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="border border-border bg-muted px-1 py-px font-mono text-[0.78rem] text-foreground"
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: (props: React.ComponentProps<'pre'>) => (
    <pre
      className="my-2 overflow-x-auto border border-border bg-muted p-2 font-mono text-[0.75rem] leading-snug text-foreground"
      {...props}
    />
  ),
  blockquote: (props: React.ComponentProps<'blockquote'>) => (
    <blockquote
      className="my-2 border-l-2 border-border pl-3 text-muted-foreground italic"
      {...props}
    />
  ),
  hr: () => <hr className="my-3 border-border" />,
  table: (props: React.ComponentProps<'table'>) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border border-border text-[0.78rem]" {...props} />
    </div>
  ),
  th: (props: React.ComponentProps<'th'>) => (
    <th className="border border-border bg-muted px-2 py-1 text-left font-semibold" {...props} />
  ),
  td: (props: React.ComponentProps<'td'>) => (
    <td className="border border-border px-2 py-1 align-top" {...props} />
  ),
} as const

type ChatMessage = {
  id: string
  role: 'user' | 'agent'
  body: string
  at: string
}

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

  // Esc to close + lock scroll (compensate scrollbar width to prevent layout shift)
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
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
        className="animate-in fade-in absolute inset-0 bg-foreground/30 backdrop-blur-[2px] duration-200"
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
    <div className="flex items-center justify-between border-b border-border bg-card px-5 py-3 gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="size-1.5 shrink-0 bg-primary" />
        <span className="truncate text-xs font-medium text-foreground">{label}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
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

  useLayoutEffect(() => {
    const el = titleRef.current
    if (!el) return
    if (isEdit) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    el.focus()
    if (isEdit) {
      el.setSelectionRange(el.value.length, el.value.length)
    }
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
      className="animate-in fade-in slide-in-from-bottom-3 relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:max-h-[calc(100vh-3rem)]"
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

type LiveMessage = {
  id: string
  role: 'user' | 'agent' | 'system'
  kind: string
  body: string
  at: string
  createdAt?: string
  streaming?: boolean
  /** Agent-message phase: "commentary" → thinking; "final" → actual reply. */
  phase?: AgentPhase
  /** Codex item id for matching streaming bubbles to completion events. */
  itemId?: string
  /** Live command output accumulated from commandDelta events */
  commandOutput?: string
  /** Whether this is an in-progress command (item/started but not item/completed) */
  commandRunning?: boolean
}

/**
 * A "turn" as the UI models it: the user prompt, everything the agent did
 * while working on it (commentary + tool calls), and the final reply.
 * Grouping is inferred at render time from the flat message list.
 */
type TurnGroup = {
  /** The user prompt that opens this turn (may be null for a pre-start bootstrap). */
  user: LiveMessage | null
  /** Commentary agent messages, command executions, errors — all "thinking". */
  thinking: LiveMessage[]
  /** The final answer the agent wants the user to read. */
  final: LiveMessage | null
  /** Approximate wall-clock start time for this turn. */
  startedAt?: string
  /** Approximate wall-clock end time for this turn. */
  endedAt?: string
}

const ACTIVE_RUN_STATUSES = new Set(['starting', 'running', 'active'])

function groupByTurn(messages: LiveMessage[], completedTurns: number): TurnGroup[] {
  // First pass: split into raw per-turn buckets preserving arrival order so
  // intermediate agent messages, reasoning, and tool calls all appear as a
  // sequential trace instead of stomping on each other.
  type RawGroup = { user: LiveMessage | null; items: LiveMessage[] }
  const raw: RawGroup[] = []
  let cur: RawGroup | null = null
  for (const m of messages) {
    if (m.role === 'user') {
      cur = { user: m, items: [] }
      raw.push(cur)
      continue
    }
    if (!cur) {
      cur = { user: null, items: [] }
      raw.push(cur)
    }
    cur.items.push(m)
  }

  // Second pass: decide which single message (if any) is the turn's "final
  // answer" vs the trace. Rule: the last phase-'final' agent text message in
  // the turn is the final answer; everything else stays in thinking in order.
  // Commentary-phase messages and streaming bubbles stay in the trace.
  return raw.map(({ user, items }, groupIdx) => {
    // A turn's "response" only exists once the agent has actually finished
    // its work (turnCompleted arrived). While the turn is still in flight
    // every agent message — including the latest one — belongs in the
    // thinking/tool-call trace, because subsequent tool calls may change
    // what the agent ultimately wants to say.
    const turnDone = groupIdx < completedTurns
    let finalIdx = -1
    if (turnDone) {
      for (let i = items.length - 1; i >= 0; i--) {
        const m = items[i]
        if (m.role !== 'agent' || m.kind !== 'text') continue
        if (m.streaming) continue
        finalIdx = i
        break
      }
    }
    const thinking: LiveMessage[] = []
    let final: LiveMessage | null = null
    items.forEach((m, i) => {
      if (i === finalIdx) final = m
      else thinking.push(m)
    })
    const startedAt = user?.createdAt ?? items.find(m => !!m.createdAt)?.createdAt
    const endedAt = [...items].reverse().find(m => !!m.createdAt)?.createdAt ?? user?.createdAt
    return { user, thinking, final, startedAt, endedAt }
  })
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatWorkedFor(startedAt?: string, endedAt?: string, nowMs?: number) {
  if (!startedAt) return null
  const startMs = Date.parse(startedAt)
  if (Number.isNaN(startMs)) return null
  const endMs = endedAt ? Date.parse(endedAt) : (nowMs ?? Date.now())
  if (Number.isNaN(endMs)) return null
  const totalSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts =
    hours > 0
      ? [`${hours}h`, `${minutes}m`]
      : minutes > 0
        ? [`${minutes}m`, `${seconds}s`]
        : [`${seconds}s`]
  return `Worked for ${parts.join(' ')}`
}

function ProjectPathChip({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  async function copyPath() {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('[task-dialog] failed to copy path', e)
    }
  }

  return (
    <span className="inline-flex max-w-full items-center border border-border bg-muted text-[0.78rem] font-medium text-foreground">
      <span className="flex min-w-0 items-center gap-1.5 px-2 py-0.5">
        <Folder size={13} weight="duotone" />
        <span className="truncate">{path}</span>
      </span>
      <button
        type="button"
        onClick={copyPath}
        className="flex h-full shrink-0 items-center justify-center border-l border-border px-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label={`Copy directory path ${path}`}
        title={copied ? 'Copied' : 'Copy path'}
      >
        {copied ? <Check size={12} weight="bold" /> : <CopySimple size={12} weight="bold" />}
      </button>
    </span>
  )
}

function ChatPanel({ task, close }: { task: TaskCard; close: () => void }) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  // Number of agent turns that have fully completed. groupByTurn uses this to
  // decide whether the last message of a group is the agent's real "response"
  // (turn done) or just an intermediate message still inside the trace.
  const [completedTurns, setCompletedTurns] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // "Stuck to bottom" — if the user scrolls up manually we stop auto-scrolling
  // so we don't hijack their read position. Reset when they scroll back down.
  const stickyRef = useRef(true)
  // Track the currently-streaming agent message (by itemId) so deltas append
  // to a single bubble until item/completed replaces it.
  const streamingRef = useRef<{ itemId: string; msgId: string } | null>(null)
  // Maps an in-flight agentMessage itemId to its phase. Populated by
  // `itemStarted` events and consulted when deltas arrive so the streaming
  // bubble can be placed in the correct bucket (thinking vs final).
  const itemPhaseRef = useRef<Map<string, AgentPhase>>(new Map())

  // Bootstrap: fetch the active run + its persisted messages, then subscribe to SSE.
  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    ;(async () => {
      const { run, messages: persisted } = await api.fetchRun(task.id)
      if (cancelled) return
      if (!run) {
        setMessages([
          {
            id: 'bootstrap',
            role: 'system',
            kind: 'status',
            body: 'No active codex run for this task yet.',
            at: '',
          },
        ])
        return
      }
      setRunId(run.id)
      setRunStatus(run.status)
      // Every persisted turn except (possibly) the currently-active one is
      // already complete. Use the run's live status to decide whether the
      // most recent group counts as finished — if the run is idle/completed
      // all user messages represent closed turns; if it's actively running,
      // the final (latest) user message's turn is still in flight.
      {
        const userCount = persisted.filter(m => m.role === 'user').length
        const active = ACTIVE_RUN_STATUSES.has(run.status)
        setCompletedTurns(active ? Math.max(0, userCount - 1) : userCount)
      }
      setMessages(
        persisted
          // Drop lifecycle noise ("thread started: …", "agent exited …") from
          // legacy runs. Current runs no longer persist these rows at all.
          .filter(m => m.kind !== 'status')
          .map(m => {
            const meta = (m.meta ?? null) as { phase?: AgentPhase } | null
            return {
              id: `p-${m.seq}`,
              role: m.role,
              kind: m.kind,
              body: m.content,
              at: formatTime(m.created_at),
              createdAt: m.created_at,
              phase: meta?.phase,
            }
          })
      )

      unsubscribe = api.subscribeRunEvents(run.id, ev => {
        if (ev.type === 'turnStarted') {
          setRunStatus('active')
          setThinking(true)
        } else if (ev.type === 'itemStarted') {
          setThinking(false) // Agent is doing something — stop thinking
          // Remember the phase for agent messages so streaming deltas can be
          // classified correctly (commentary vs final).
          if (ev.itemType === 'agentMessage' && ev.phase) {
            itemPhaseRef.current.set(ev.itemId, ev.phase)
          }
          if (ev.itemType === 'commandExecution' && ev.command) {
            // Insert a running command bubble
            setMessages(prev => [
              ...prev,
              {
                id: `cmd-${ev.itemId}`,
                role: 'system',
                kind: 'command',
                body: `$ ${ev.command}`,
                at: '',
                commandRunning: true,
                commandOutput: '',
              },
            ])
          }
        } else if (ev.type === 'commandDelta') {
          // Append stdout/stderr to the running command bubble
          setMessages(prev =>
            prev.map(p =>
              p.id === `cmd-${ev.itemId}`
                ? { ...p, commandOutput: (p.commandOutput ?? '') + ev.delta }
                : p
            )
          )
        } else if (ev.type === 'message') {
          // Skip lifecycle "status" messages entirely — they're plumbing noise.
          if (ev.kind === 'status') return
          // Only clear the thinking indicator for agent/system messages.
          // The server echoes the user's own follow-up message first — if we
          // clear on that, the indicator disappears before the agent replies.
          if (ev.role !== 'user') setThinking(false)
          setMessages(prev => {
            // Skip if we already have this seq (replay + live overlap).
            if (prev.some(p => p.id === `p-${ev.seq}`)) return prev
            // De-dupe: if we already have an agent message for this itemId
            // (streaming bubble or an earlier persisted copy), drop it so the
            // incoming authoritative row replaces it instead of duplicating.
            // Also drop any earlier agent message with identical body text —
            // Codex sometimes emits the same preamble as both a `reasoning`
            // item and a subsequent `agentMessage` item under different ids,
            // which would otherwise render as two identical bubbles.
            if (ev.role === 'agent') {
              const incomingBody = (ev.content ?? '').trim()
              prev = prev.filter(p => {
                if (ev.itemId && p.itemId === ev.itemId) return false
                if (
                  p.role === 'agent' &&
                  p.kind === 'text' &&
                  incomingBody &&
                  p.body.trim() === incomingBody
                )
                  return false
                return true
              })
            }
            // De-dupe user messages: the optimistic bubble we added on send
            // gets replaced by the authoritative persisted row when it lands.
            if (ev.role === 'user') {
              const incomingBody = (ev.content ?? '').trim()
              prev = prev.filter(
                p =>
                  !(
                    p.id.startsWith('u-local-') &&
                    p.role === 'user' &&
                    p.body.trim() === incomingBody
                  )
              )
            }
            // If a completed command message arrives, replace the running bubble
            if (ev.kind === 'command') {
              const existingCmd = prev.find(
                p =>
                  p.kind === 'command' &&
                  p.commandRunning &&
                  ev.content.startsWith(p.body.slice(0, 20))
              )
              if (existingCmd) {
                return prev.map(p =>
                  p.id === existingCmd.id
                    ? {
                        ...p,
                        id: `p-${ev.seq}`,
                        body: ev.content,
                        commandRunning: false,
                        at: formatTime(ev.createdAt),
                        createdAt: ev.createdAt,
                      }
                    : p
                )
              }
            }
            return [
              ...prev,
              {
                id: `p-${ev.seq}`,
                role: ev.role,
                kind: ev.kind,
                body: ev.content,
                at: formatTime(ev.createdAt),
                createdAt: ev.createdAt,
                phase: ev.phase,
                itemId: ev.itemId,
              },
            ]
          })
          // Only drop the streaming bubble if *this* item is the one that was
          // streaming. Reasoning items and earlier agent messages must not
          // destroy an in-flight stream for a different item.
          // The itemId-based de-dupe above already removed the streaming
          // bubble; just clear the ref so the next delta starts fresh.
          if (ev.role === 'agent' && ev.itemId && streamingRef.current?.itemId === ev.itemId) {
            streamingRef.current = null
          }
          if (ev.itemId) itemPhaseRef.current.delete(ev.itemId)
        } else if (ev.type === 'delta') {
          setThinking(false)
          setMessages(prev => {
            if (!streamingRef.current || streamingRef.current.itemId !== ev.itemId) {
              const msgId = `s-${ev.itemId}`
              streamingRef.current = { itemId: ev.itemId, msgId }
              // Default to "final" when phase is unknown so deltas always land
              // in the prominent slot; commentary items typically don't stream.
              const phase = itemPhaseRef.current.get(ev.itemId) ?? 'final'
              return [
                ...prev,
                {
                  id: msgId,
                  role: 'agent',
                  kind: 'text',
                  body: ev.delta,
                  at: '',
                  createdAt: new Date().toISOString(),
                  streaming: true,
                  phase,
                  itemId: ev.itemId,
                },
              ]
            }
            const msgId = streamingRef.current.msgId
            return prev.map(p => (p.id === msgId ? { ...p, body: p.body + ev.delta } : p))
          })
        } else if (ev.type === 'turnCompleted') {
          setRunStatus('idle')
          setThinking(false)
          setCompletedTurns(n => n + 1)
          // Mark any remaining running commands as done
          setMessages(prev =>
            prev.map(p => (p.commandRunning ? { ...p, commandRunning: false } : p))
          )
        } else if (ev.type === 'end') {
          setRunStatus('completed')
          setThinking(false)
        }
      })
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.id])

  // Auto-scroll to bottom whenever messages change (including mid-stream
  // delta updates), but only if the user hasn't scrolled up to read earlier
  // content. Uses rAF so the scroll lands after layout, and scrollIntoView
  // on a sentinel to avoid relying on scrollHeight before reflow.
  useEffect(() => {
    if (messages.length === 0 && !thinking) return
    if (!stickyRef.current) return
    const raf = requestAnimationFrame(() => {
      const bottom = bottomRef.current
      if (bottom) {
        bottom.scrollIntoView({ block: 'end' })
        return
      }
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
    return () => cancelAnimationFrame(raf)
  }, [messages, thinking])

  // Detect whether the user is pinned to the bottom. When they scroll away
  // we pause auto-scroll; when they come back we resume.
  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    stickyRef.current = distance < 80
  }

  async function send() {
    const body = draft.trim()
    if (
      !body ||
      !runId ||
      (runStatus != null && !ACTIVE_RUN_STATUSES.has(runStatus) && runStatus !== 'idle')
    )
      return
    setDraft('')
    // Optimistic feedback: show the user's bubble *and* mark a fresh in-flight
    // turn immediately, so the working indicator flips on the instant they
    // press send — no waiting for the server round-trip or Codex handshake.
    const nowIso = new Date().toISOString()
    const localId = `u-local-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: localId, role: 'user', kind: 'text', body, at: '', createdAt: nowIso },
    ])
    setThinking(true)
    try {
      await api.sendFollowUp(runId, body)
    } catch (e) {
      console.error('[chat] follow-up failed', e)
      setThinking(false)
      // Roll back the optimistic bubble on failure.
      setMessages(prev => prev.filter(p => p.id !== localId))
    }
  }

  // Group the flat message list into turn blocks. Memoized so we don't
  // re-walk the list on every render while deltas stream.
  const turns = useMemo(() => groupByTurn(messages, completedTurns), [messages, completedTurns])
  const hasInteractiveRun =
    !!runId && !!runStatus && (ACTIVE_RUN_STATUSES.has(runStatus) || runStatus === 'idle')

  return (
    <section className="animate-in fade-in slide-in-from-bottom-3 relative z-10 flex h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:h-[calc(100vh-3rem)]">
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
            {runStatus && (
              <span className="ml-1 inline-flex shrink-0 items-center gap-1 border border-border bg-background px-1.5 py-0.5 text-[0.55rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                {runStatus}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center pl-7">
            <ProjectPathChip path={task.project} />
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
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto bg-background px-5 py-4"
      >
        {turns.map((group, idx) => {
          const isLast = idx === turns.length - 1
          // A turn is still in-flight when it's the most recent group *and*
          // the number of completed turns hasn't caught up to it yet. While
          // in-flight, the collapsible header shows a live spinner so the
          // user can see the agent is actively working.
          const inFlight = isLast && hasInteractiveRun && idx >= completedTurns
          const showThinkingDots = isLast && thinking
          return (
            <TurnBlock
              key={group.user?.id ?? `g-${idx}`}
              group={group}
              agentIcon={AgentIcon}
              showThinkingDots={showThinkingDots}
              inFlight={inFlight}
            />
          )
        })}
        <div ref={bottomRef} aria-hidden="true" />
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
            rows={2}
            placeholder="Send a follow-up to the agent…"
            className="max-h-32 min-h-6 flex-1 resize-none bg-transparent px-1 text-sm leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || !hasInteractiveRun}
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

/**
 * Renders a single turn: the user prompt, a collapsible "thinking" section
 * containing commentary + tool calls, and then the final answer. The
 * collapsible defaults to open — the user can fold it away once they've seen
 * what the agent did, so the final answer gets the room it deserves.
 */
function TurnBlock({
  group,
  agentIcon: AgentIcon,
  showThinkingDots,
  inFlight,
}: {
  group: TurnGroup
  agentIcon: React.ComponentType<{ size?: number }>
  showThinkingDots: boolean
  inFlight: boolean
}) {
  // Always render the collapsible for an in-flight turn so the label and
  // elapsed timer appear the instant the user sends — even before any trace
  // items or thinking dots have landed.
  const hasThinking = group.thinking.length > 0 || showThinkingDots || inFlight
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!inFlight) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [inFlight])
  const workedFor = formatWorkedFor(group.startedAt, inFlight ? undefined : group.endedAt, nowMs)
  return (
    <div className="space-y-3">
      {group.user && <LiveChatBubble message={group.user} agentIcon={AgentIcon} />}

      {hasThinking && (
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="group/th flex w-full items-center gap-2 border border-dashed border-border bg-muted/40 px-3 py-1.5 text-left transition-colors hover:border-foreground/40 hover:bg-muted aria-expanded:border-foreground/30">
            <CaretRight
              size={11}
              weight="bold"
              className="shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded/th:rotate-90"
            />
            <span className="text-[0.6rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Reasoning
            </span>
            {workedFor && (
              <span className="ml-auto text-[0.55rem] font-medium tabular-nums text-muted-foreground">
                {workedFor}
              </span>
            )}
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 border-l-2 border-dashed border-border pl-3">
            <div className="space-y-2.5">
              {group.thinking.map(m => (
                <LiveChatBubble key={m.id} message={m} agentIcon={AgentIcon} muted />
              ))}
              {showThinkingDots && <ThinkingDots agentIcon={AgentIcon} />}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {group.final && <LiveChatBubble message={group.final} agentIcon={AgentIcon} />}
    </div>
  )
}

function ThinkingDots({
  agentIcon: AgentIcon,
}: {
  agentIcon: React.ComponentType<{ size?: number }>
}) {
  return (
    <div className="flex gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center border border-border bg-card text-foreground">
        <AgentIcon size={11} />
      </span>
      <div className="flex items-center gap-1.5 border border-border bg-card px-3 py-2">
        <span className="inline-flex gap-1">
          <span
            className="size-1.5 animate-bounce bg-muted-foreground"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="size-1.5 animate-bounce bg-muted-foreground"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="size-1.5 animate-bounce bg-muted-foreground"
            style={{ animationDelay: '300ms' }}
          />
        </span>
        <span className="ml-1 text-xs text-muted-foreground">Thinking…</span>
      </div>
    </div>
  )
}

function LiveChatBubble({
  message,
  agentIcon: AgentIcon,
  muted = false,
}: {
  message: LiveMessage
  agentIcon: React.ComponentType<{ size?: number }>
  /** Render in a quieter style (used inside the thinking section). */
  muted?: boolean
}) {
  if (message.role === 'system') {
    const isError = message.kind === 'error'
    const isCommand = message.kind === 'command'

    if (isCommand) {
      return (
        <div className="overflow-hidden border border-border bg-foreground/3">
          <div className="flex min-w-0 items-center gap-2 border-b border-border px-3 py-1.5">
            {message.commandRunning && (
              <span className="size-1.5 shrink-0 animate-pulse bg-primary" />
            )}
            <span
              className="min-w-0 truncate font-mono text-[0.7rem] font-medium text-foreground"
              title={message.body}
            >
              {message.body}
            </span>
            {message.commandRunning && (
              <span className="ml-auto text-[0.55rem] tracking-[0.12em] text-muted-foreground uppercase">
                running
              </span>
            )}
          </div>
          {message.commandOutput && (
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-[0.68rem] leading-relaxed text-muted-foreground">
              {message.commandOutput}
            </pre>
          )}
        </div>
      )
    }

    return (
      <div
        className={[
          'border-l-2 px-3 py-1.5 font-mono text-[0.7rem] leading-snug',
          isError
            ? 'border-red-500 bg-red-500/5 text-red-600'
            : 'border-border bg-muted text-muted-foreground',
        ].join(' ')}
      >
        {message.body}
      </div>
    )
  }
  const isUser = message.role === 'user'
  return (
    <div className={`flex min-w-0 gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!muted && (
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
      )}
      <div
        className={`flex min-w-0 max-w-[80%] flex-col ${isUser ? 'items-end text-right' : 'items-start text-left'}`}
      >
        <div
          className={[
            'min-w-0 max-w-full overflow-hidden border wrap-break-word',
            muted ? 'px-2.5 py-1.5 text-[0.78rem] leading-snug' : 'px-3 py-2 text-sm leading-snug',
            isUser
              ? 'whitespace-pre-wrap border-foreground bg-foreground text-background'
              : muted
                ? 'border-border/70 bg-muted/30 text-muted-foreground'
                : 'border-border bg-card text-foreground',
            message.streaming ? 'animate-pulse' : '',
          ].join(' ')}
        >
          {isUser ? (
            message.body || (message.streaming ? '…' : '')
          ) : message.body ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
              {message.body}
            </ReactMarkdown>
          ) : message.streaming ? (
            '…'
          ) : null}
        </div>
        {!muted && message.at && (
          <span className="mt-1 text-[0.55rem] tracking-widest text-muted-foreground uppercase">
            {message.at}
          </span>
        )}
      </div>
    </div>
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
    <section className="animate-in fade-in slide-in-from-bottom-3 relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:max-h-[calc(100vh-3rem)]">
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
            <ProjectPathChip path={task.project} />
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
