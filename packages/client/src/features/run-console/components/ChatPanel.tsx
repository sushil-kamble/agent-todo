import { ACTIVE_RUN_STATUSES } from '@agent-todo/shared/constants/run-status'
import { ArrowDownIcon, ArrowUpIcon, CaretRightIcon, StopIcon, XIcon } from '@phosphor-icons/react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentPhase } from '#/entities/run'
import type { TaskCard } from '#/entities/task/types'
import { getEffortLabel, getModelLabel } from '#/features/agent-config/model/model-config'
import { getTaskModeLabel } from '#/features/agent-config/model/task-config'
import { getTaskTypeLabel } from '#/features/agent-config/model/task-type-config'
import * as api from '#/features/run-console/api'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/shared/ui/collapsible'
import { ClaudeIcon, OpenAIIcon } from '#/shared/ui/icons'
import type { LiveMessage } from '../model/types'
import {
  formatTime,
  formatWorkedForDuration,
  getWorkedTimeDuration,
  groupByTurn,
} from '../model/utils'
import { ProjectPathChip, TurnBlock } from './shared'

const USER_CANCELLED_EXECUTION = '--- User cancelled execution ---'
const LOCAL_INTERRUPTED_MARKER_PREFIX = 'interrupt-local-'
type StreamingItemMeta = {
  kind: 'text' | 'reasoning'
  phase?: AgentPhase
  provider?: 'claude' | 'codex'
  reasoningFormat?: 'summary' | 'raw'
}

function isInterruptedMarker(message: Pick<LiveMessage, 'role' | 'kind' | 'interruptedByUser'>) {
  return message.role === 'system' && message.kind === 'error' && message.interruptedByUser === true
}

function stripLocalInterruptedMarkers(messages: LiveMessage[]) {
  return messages.filter(message => !message.id.startsWith(LOCAL_INTERRUPTED_MARKER_PREFIX))
}

function getHeaderRunState(status: string | null) {
  if (!status) return null
  if (ACTIVE_RUN_STATUSES.has(status)) {
    return {
      label: 'Working',
      className:
        'border-amber-700/35 bg-amber-100 text-amber-950 dark:border-amber-300/30 dark:bg-amber-400/15 dark:text-amber-100',
    }
  }
  if (status === 'idle' || status === 'interrupted') {
    return {
      label: 'Idle',
      className:
        'border-emerald-700/30 bg-emerald-100 text-emerald-950 dark:border-emerald-300/30 dark:bg-emerald-400/15 dark:text-emerald-100',
    }
  }
  if (status === 'failed') {
    return {
      label: 'Failed',
      className:
        'border-red-700/30 bg-red-100 text-red-900 dark:border-red-300/30 dark:bg-red-400/15 dark:text-red-100',
    }
  }
  if (status === 'completed') {
    return {
      label: 'Complete',
      className:
        'border-sky-700/30 bg-sky-100 text-sky-950 dark:border-sky-300/30 dark:bg-sky-400/15 dark:text-sky-100',
    }
  }
  return {
    label: status,
    className:
      'border-border bg-muted text-foreground dark:border-border dark:bg-muted dark:text-foreground',
  }
}

function formatTaskModelSummary(task: TaskCard) {
  return `${getModelLabel(task.agent, task.model)} (${getEffortLabel(task.effort)}${task.fastMode ? ', Fast' : ''})`
}

function formatAgentModelSummary(task: TaskCard, agentLabel: string) {
  return `${agentLabel} / ${formatTaskModelSummary(task)}`
}

function formatModeTaskTypeSummary(task: TaskCard) {
  const taskTypeLabel = task.taskType ? getTaskTypeLabel(task.taskType) : null
  return taskTypeLabel
    ? `${getTaskModeLabel(task.mode)} / ${taskTypeLabel}`
    : getTaskModeLabel(task.mode)
}

function getTaskInfoSummary(task: TaskCard, agentLabel: string) {
  const parts = [formatModeTaskTypeSummary(task), formatAgentModelSummary(task, agentLabel)]

  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

function TaskInfoField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-[0.58rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="min-w-0 text-[0.72rem] leading-snug text-foreground">{children}</div>
    </div>
  )
}

function TaskInfoPairValue({
  primary,
  secondary,
  icon,
}: {
  primary: React.ReactNode
  secondary?: React.ReactNode
  icon?: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1.5 text-[0.72rem] leading-snug text-foreground">
        {icon ? <span className="shrink-0">{icon}</span> : null}
        <span className="truncate">{primary}</span>
        {secondary ? (
          <>
            <span className="shrink-0 text-muted-foreground">/</span>
            <span className="truncate text-muted-foreground">{secondary}</span>
          </>
        ) : null}
      </div>
    </div>
  )
}

export function ChatPanel({
  task,
  close,
  readOnly = false,
}: {
  task: TaskCard
  close: () => void
  readOnly?: boolean
}) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'
  const [runId, setRunId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [completedTurns, setCompletedTurns] = useState(0)
  const [scrollReady, setScrollReady] = useState(false)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [headerNowMs, setHeaderNowMs] = useState(() => Date.now())
  const didInitialScrollRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const draftInputRef = useRef<HTMLTextAreaElement>(null)
  const stickyRef = useRef(true)
  const streamingRefs = useRef<Map<string, string>>(new Map())
  const itemMetaRef = useRef<Map<string, StreamingItemMeta>>(new Map())
  const interruptPendingRef = useRef(false)

  const resizeDraftInput = useCallback(() => {
    const el = draftInputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`
  }, [])

  const syncScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNearBottom = distance < 80
    stickyRef.current = isNearBottom
    setShowScrollToBottom(el.scrollHeight > el.clientHeight && !isNearBottom)
  }, [])

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    ;(async () => {
      const { run, messages: persisted } = await api.fetchRun(
        task.id,
        readOnly ? { autostart: false } : undefined
      )
      if (cancelled) return
      if (!run) {
        setMessages([
          {
            id: 'bootstrap',
            role: 'system',
            kind: 'status',
            body: readOnly
              ? 'No saved history for this task yet.'
              : `No active ${task.agent === 'claude' ? 'Claude' : 'Codex'} run for this task yet.`,
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
            const meta = (m.meta ?? null) as {
              phase?: AgentPhase
              itemId?: string
              provider?: 'claude' | 'codex'
              reasoningFormat?: 'summary' | 'raw'
              interruptedByUser?: boolean
            } | null
            return {
              id: `p-${m.seq}`,
              role: m.role,
              kind: m.kind,
              body: m.content,
              at: formatTime(m.created_at),
              createdAt: m.created_at,
              phase: meta?.phase,
              itemId: meta?.itemId,
              provider: meta?.provider,
              reasoningFormat: meta?.reasoningFormat,
              interruptedByUser:
                m.role === 'system' &&
                m.kind === 'error' &&
                (meta?.interruptedByUser === true || m.content === USER_CANCELLED_EXECUTION),
            }
          })
      )

      if (readOnly) return

      unsubscribe = api.subscribeRunEvents(run.id, ev => {
        if (ev.type === 'turnStarted') {
          setRunStatus('active')
          setThinking(true)
          return
        }

        if (ev.type === 'itemStarted') {
          setThinking(false)
          if (ev.itemType === 'agentMessage') {
            itemMetaRef.current.set(ev.itemId, {
              kind: 'text',
              phase: ev.phase,
            })
          } else if (ev.itemType === 'reasoning') {
            itemMetaRef.current.set(ev.itemId, {
              kind: 'reasoning',
              provider: ev.provider,
              reasoningFormat: ev.reasoningFormat,
            })
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
            if (ev.interruptedByUser === true) {
              prev = stripLocalInterruptedMarkers(prev)
            }
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
                provider: ev.provider,
                reasoningFormat: ev.reasoningFormat,
                interruptedByUser: ev.interruptedByUser === true,
              },
            ]
          })

          if (ev.itemId) {
            streamingRefs.current.delete(ev.itemId)
            itemMetaRef.current.delete(ev.itemId)
          }
          return
        }

        if (ev.type === 'delta') {
          setThinking(false)
          setMessages(prev => {
            const existingId = streamingRefs.current.get(ev.itemId)
            if (!existingId) {
              const msgId = `s-${ev.itemId}`
              streamingRefs.current.set(ev.itemId, msgId)
              const baseMeta = itemMetaRef.current.get(ev.itemId) ?? {
                kind: ev.kind,
              }
              const nextMeta = {
                ...baseMeta,
                kind: ev.kind,
                phase: ev.phase ?? baseMeta.phase,
                provider: ev.provider ?? baseMeta.provider,
                reasoningFormat: ev.reasoningFormat ?? baseMeta.reasoningFormat,
              }
              itemMetaRef.current.set(ev.itemId, nextMeta)
              return [
                ...prev,
                {
                  id: msgId,
                  role: 'agent',
                  kind: ev.kind,
                  body: ev.delta,
                  at: '',
                  createdAt: new Date().toISOString(),
                  streaming: true,
                  phase: nextMeta.phase,
                  itemId: ev.itemId,
                  provider: nextMeta.provider,
                  reasoningFormat: nextMeta.reasoningFormat,
                },
              ]
            }
            const msgId = existingId
            return prev.map(p => {
              if (p.id !== msgId) return p
              return {
                ...p,
                body: p.body + ev.delta,
                provider: ev.provider ?? p.provider,
                reasoningFormat: ev.reasoningFormat ?? p.reasoningFormat,
                phase: ev.phase ?? p.phase,
              }
            })
          })
          return
        }

        if (ev.type === 'turnCompleted') {
          const interruptedByUser = interruptPendingRef.current
          interruptPendingRef.current = false
          setRunStatus(
            interruptedByUser ? 'idle' : ev.status === 'interrupted' ? 'interrupted' : 'idle'
          )
          setThinking(false)
          setCompletedTurns(n => n + 1)
          setMessages(prev =>
            prev.map(p => (p.commandRunning ? { ...p, commandRunning: false } : p))
          )
          return
        }

        if (ev.type === 'end') {
          const interruptedByUser = interruptPendingRef.current
          interruptPendingRef.current = false
          setRunStatus(interruptedByUser ? 'idle' : (ev.status ?? 'completed'))
          setThinking(false)
        }
      })
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [task.id, task.agent, readOnly])

  useEffect(() => {
    if (!runStatus || !ACTIVE_RUN_STATUSES.has(runStatus)) {
      setStopping(false)
    }
  }, [runStatus])

  useLayoutEffect(() => {
    if (messages.length === 0 && !thinking) return
    const el = scrollRef.current
    if (!el) return

    // First paint: jump to bottom synchronously before the browser paints,
    // so the user never sees the scroll start at the top and snap down.
    if (!didInitialScrollRef.current) {
      el.scrollTop = el.scrollHeight
      didInitialScrollRef.current = true
      setScrollReady(true)
      syncScrollState()
      return
    }

    if (!stickyRef.current) {
      syncScrollState()
      return
    }
    const bottom = bottomRef.current
    if (bottom) {
      bottom.scrollIntoView({ block: 'end', behavior: 'smooth' })
      requestAnimationFrame(syncScrollState)
      return
    }
    el.scrollTop = el.scrollHeight
    syncScrollState()
  }, [messages, thinking, syncScrollState])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    syncScrollState()
    const ro = new ResizeObserver(syncScrollState)
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncScrollState])

  useLayoutEffect(() => {
    resizeDraftInput()
  }, [resizeDraftInput])

  function handleScroll() {
    syncScrollState()
  }

  function scrollToBottom() {
    const el = scrollRef.current
    if (!el) return
    stickyRef.current = true
    setShowScrollToBottom(false)
    el.scrollTop = el.scrollHeight
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    requestAnimationFrame(syncScrollState)
  }

  async function send() {
    const body = draft.trim()
    if (
      readOnly ||
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

  async function stop() {
    if (readOnly || !runId || !runStatus || !ACTIVE_RUN_STATUSES.has(runStatus) || stopping) {
      return
    }

    setStopping(true)
    interruptPendingRef.current = true
    const nowIso = new Date().toISOString()
    setMessages(prev => {
      const lastMessage = prev.at(-1)
      if (lastMessage && isInterruptedMarker(lastMessage)) return prev
      return [
        ...prev,
        {
          id: `${LOCAL_INTERRUPTED_MARKER_PREFIX}${Date.now()}`,
          role: 'system',
          kind: 'error',
          body: USER_CANCELLED_EXECUTION,
          at: formatTime(nowIso),
          createdAt: nowIso,
          interruptedByUser: true,
        },
      ]
    })
    try {
      await api.stopRun(runId)
    } catch (e) {
      console.error('[chat] stop failed', e)
      interruptPendingRef.current = false
      setMessages(prev => stripLocalInterruptedMarkers(prev))
      setStopping(false)
    }
  }

  const turns = useMemo(() => groupByTurn(messages, completedTurns), [messages, completedTurns])
  const isRunActive = !readOnly && !!runId && !!runStatus && ACTIVE_RUN_STATUSES.has(runStatus)
  const hasInteractiveRun =
    !readOnly &&
    !!runId &&
    !!runStatus &&
    (ACTIVE_RUN_STATUSES.has(runStatus) || runStatus === 'idle')
  const canSend = !readOnly && !!runId && runStatus === 'idle'
  const headerRunState = getHeaderRunState(runStatus)
  const workedTimeMs = useMemo(
    () => getWorkedTimeDuration(turns, isRunActive, headerNowMs),
    [turns, isRunActive, headerNowMs]
  )
  const taskInfoSummary = useMemo(() => getTaskInfoSummary(task, agentLabel), [task, agentLabel])
  const workedTimeLabel = useMemo(() => formatWorkedForDuration(workedTimeMs), [workedTimeMs])

  useEffect(() => {
    if (!isRunActive) return
    setHeaderNowMs(Date.now())
    const intervalId = window.setInterval(() => setHeaderNowMs(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [isRunActive])

  return (
    <section className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 relative z-10 flex h-[calc(100vh-2rem)] w-full max-w-4xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:h-[calc(100vh-3rem)]">
      <div className="border-b border-border bg-card px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight text-foreground">
              {task.title}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            {headerRunState && (
              <span
                className={`inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[0.58rem] font-semibold tracking-[0.08em] uppercase ${headerRunState.className}`}
              >
                {headerRunState.label}
              </span>
            )}
            <button
              type="button"
              onClick={close}
              className="flex size-6 shrink-0 items-center justify-center border border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              aria-label="Close"
            >
              <XIcon size={12} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-card/70">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="group/task-info flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-background/40 aria-expanded:bg-background/20">
            <CaretRightIcon
              size={11}
              weight="bold"
              className="shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded/task-info:rotate-90"
            />
            <span className="shrink-0 text-[0.58rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Task info
            </span>
            <span className="min-w-0 truncate text-[0.68rem] text-muted-foreground">
              {taskInfoSummary}
            </span>
            {workedTimeLabel ? (
              <span className="ml-auto shrink-0 text-[0.68rem] font-medium tabular-nums text-muted-foreground">
                {workedTimeLabel}
              </span>
            ) : null}
          </CollapsibleTrigger>

          <CollapsibleContent className="border-t border-border bg-background/35 px-5 py-3">
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
              <TaskInfoField label="Agent / model">
                <TaskInfoPairValue
                  primary={agentLabel}
                  secondary={formatTaskModelSummary(task)}
                  icon={
                    <span
                      className="flex size-4 items-center justify-center border border-border bg-background text-foreground"
                      title={agentLabel}
                    >
                      <AgentIcon size={9} />
                    </span>
                  }
                />
              </TaskInfoField>

              <TaskInfoField label="Mode / task type">
                <TaskInfoPairValue
                  primary={getTaskModeLabel(task.mode)}
                  secondary={task.taskType ? getTaskTypeLabel(task.taskType) : undefined}
                />
              </TaskInfoField>

              <TaskInfoField label="Project">
                <ProjectPathChip path={task.project} />
              </TaskInfoField>

              {workedTimeLabel && (
                <TaskInfoField label="Worked time">{workedTimeLabel}</TaskInfoField>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex-1 space-y-5 overflow-x-hidden overflow-y-auto bg-background px-5 py-4 transition-opacity duration-150 ${scrollReady ? 'opacity-100' : 'opacity-0'}`}
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

      {showScrollToBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          aria-label="Scroll to latest message"
          className="absolute right-6 bottom-22 z-20 flex size-8 items-center justify-center border border-foreground bg-background/95 text-foreground shadow-[3px_3px_0_0_oklch(0.18_0.012_80/0.08)] backdrop-blur-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-foreground hover:text-background active:translate-y-0"
        >
          <ArrowDownIcon size={14} weight="bold" />
        </button>
      )}

      {!readOnly && (
        <div className="border-t border-border bg-card px-3 py-3">
          <div className="flex items-end gap-2 border border-border bg-background px-2 py-1.5 focus-within:border-foreground">
            <textarea
              ref={draftInputRef}
              value={draft}
              onChange={e => {
                setDraft(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey && canSend) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={2}
              placeholder="Send a follow-up to the agent…"
              className="max-h-32 min-h-6 flex-1 resize-none overflow-y-auto bg-transparent px-1 text-sm leading-snug text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
            <button
              type="button"
              onClick={isRunActive ? stop : send}
              disabled={isRunActive ? stopping : !draft.trim() || !canSend}
              className={[
                'flex size-7 items-center justify-center border transition-colors disabled:opacity-30',
                isRunActive
                  ? 'border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
                  : 'border-primary bg-primary text-primary-foreground hover:bg-primary/90',
              ].join(' ')}
              aria-label={isRunActive ? 'Stop' : 'Send'}
            >
              {isRunActive ? (
                <StopIcon size={13} weight="fill" />
              ) : (
                <ArrowUpIcon size={13} weight="bold" />
              )}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
