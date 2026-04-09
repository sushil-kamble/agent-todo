import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, X } from '@phosphor-icons/react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import * as api from '#/lib/api'
import type { AgentPhase } from '#/lib/api'
import type { TaskCard } from '../types'
import { ACTIVE_RUN_STATUSES } from './constants'
import { ProjectPathChip, TurnBlock } from './shared'
import type { LiveMessage } from './types'
import { formatTime, groupByTurn } from './utils'

export function ChatPanel({ task, close }: { task: TaskCard; close: () => void }) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [completedTurns, setCompletedTurns] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef(true)
  const streamingRef = useRef<{ itemId: string; msgId: string } | null>(null)
  const itemPhaseRef = useRef<Map<string, AgentPhase>>(new Map())

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
            body: `No active ${task.agent === 'claude' ? 'Claude' : 'Codex'} run for this task yet.`,
            at: '',
          },
        ])
        return
      }

      setRunId(run.id)
      setRunStatus(run.status)

      const userCount = persisted.filter(m => m.role === 'user').length
      const active = ACTIVE_RUN_STATUSES.has(run.status)
      setCompletedTurns(active ? Math.max(0, userCount - 1) : userCount)

      setMessages(
        persisted
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
          return
        }

        if (ev.type === 'itemStarted') {
          setThinking(false)
          if (ev.itemType === 'agentMessage' && ev.phase) {
            itemPhaseRef.current.set(ev.itemId, ev.phase)
          }
          if (ev.itemType === 'commandExecution' && ev.command) {
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
          return
        }

        if (ev.type === 'commandDelta') {
          setMessages(prev =>
            prev.map(p =>
              p.id === `cmd-${ev.itemId}`
                ? { ...p, commandOutput: (p.commandOutput ?? '') + ev.delta }
                : p
            )
          )
          return
        }

        if (ev.type === 'message') {
          if (ev.kind === 'status') return
          if (ev.role !== 'user') setThinking(false)
          setMessages(prev => {
            if (prev.some(p => p.id === `p-${ev.seq}`)) return prev

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

          if (ev.role === 'agent' && ev.itemId && streamingRef.current?.itemId === ev.itemId) {
            streamingRef.current = null
          }
          if (ev.itemId) itemPhaseRef.current.delete(ev.itemId)
          return
        }

        if (ev.type === 'delta') {
          setThinking(false)
          setMessages(prev => {
            if (!streamingRef.current || streamingRef.current.itemId !== ev.itemId) {
              const msgId = `s-${ev.itemId}`
              streamingRef.current = { itemId: ev.itemId, msgId }
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
          return
        }

        if (ev.type === 'turnCompleted') {
          setRunStatus('idle')
          setThinking(false)
          setCompletedTurns(n => n + 1)
          setMessages(prev =>
            prev.map(p => (p.commandRunning ? { ...p, commandRunning: false } : p))
          )
          return
        }

        if (ev.type === 'end') {
          setRunStatus('completed')
          setThinking(false)
        }
      })
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.id, task.agent])

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
      setMessages(prev => prev.filter(p => p.id !== localId))
    }
  }

  const turns = useMemo(() => groupByTurn(messages, completedTurns), [messages, completedTurns])
  const hasInteractiveRun =
    !!runId && !!runStatus && (ACTIVE_RUN_STATUSES.has(runStatus) || runStatus === 'idle')

  return (
    <section className="relative z-10 flex h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] sm:h-[calc(100vh-3rem)]">
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

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto bg-background px-5 py-4"
      >
        {turns.map((group, idx) => {
          const isLast = idx === turns.length - 1
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
