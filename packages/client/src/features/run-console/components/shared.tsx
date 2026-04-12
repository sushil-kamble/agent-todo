import { CaretRightIcon, CheckIcon, CopySimpleIcon, FolderIcon, XIcon } from '@phosphor-icons/react'
import { type ComponentType, memo, useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Agent, EffortLevel } from '#/entities/task/types'
import { getEffortLabel, getModelLabel } from '#/features/agent-config/model/model-config'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/shared/ui/collapsible'
import { WORKING_VERBS } from '../model/constants'
import { MD_COMPONENTS } from '../model/markdown'
import type { ChatMessage, LiveMessage, TurnGroup } from '../model/types'
import { formatWorkedFor } from '../model/utils'

export function PanelHeader({ label, onClose }: { label: string; onClose: () => void }) {
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
        <XIcon size={12} weight="bold" />
      </button>
    </div>
  )
}

export function ProjectPathChip({ path }: { path: string }) {
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
        <FolderIcon size={13} weight="duotone" />
        <span className="truncate">{path}</span>
      </span>
      <button
        type="button"
        onClick={copyPath}
        className="flex h-full shrink-0 items-center justify-center border-l border-border px-2 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        aria-label={`Copy directory path ${path}`}
        title={copied ? 'Copied' : 'Copy path'}
      >
        {copied ? (
          <CheckIcon size={12} weight="bold" />
        ) : (
          <CopySimpleIcon size={12} weight="bold" />
        )}
      </button>
    </span>
  )
}

export function ModelConfigChip({
  agent,
  model,
  effort,
  fastMode,
}: {
  agent: Agent
  model: string | null
  effort: EffortLevel
  fastMode: boolean
}) {
  const label = `${getModelLabel(agent, model)} (${getEffortLabel(effort)}${fastMode ? ', Fast' : ''})`

  return (
    <span className="inline-flex max-w-full items-center border border-border bg-background px-2 py-0.5 text-[0.7rem] font-medium tracking-[0.08em] text-foreground uppercase">
      <span className="truncate">{label}</span>
    </span>
  )
}

function TurnBlockImpl({
  group,
  agentIcon: AgentIcon,
  showThinkingDots,
  inFlight,
}: {
  group: TurnGroup
  agentIcon: ComponentType<{ size?: number }>
  showThinkingDots: boolean
  inFlight: boolean
}) {
  const hasThinking =
    !group.interrupted && (group.thinking.length > 0 || showThinkingDots || inFlight)

  return (
    <div className="space-y-3">
      {group.user && <LiveChatBubbleMemo message={group.user} agentIcon={AgentIcon} />}

      {group.interrupted && <InterruptedMarker />}

      {hasThinking && (
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="group/th flex w-full items-center gap-2 border border-dashed border-border bg-muted/40 px-3 py-1.5 text-left transition-colors hover:border-foreground/40 hover:bg-muted aria-expanded:border-foreground/30">
            <CaretRightIcon
              size={11}
              weight="bold"
              className="shrink-0 text-muted-foreground transition-transform duration-150 group-aria-expanded/th:rotate-90"
            />
            <CyclingVerb active={inFlight || showThinkingDots} />
            <WorkedForBadge
              startedAt={group.startedAt}
              endedAt={group.endedAt}
              inFlight={inFlight}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 border-l-2 border-dashed border-border pl-3">
            <div className="space-y-2.5">
              {group.thinking.map(m => (
                <LiveChatBubbleMemo key={m.id} message={m} agentIcon={AgentIcon} muted />
              ))}
              {showThinkingDots && <ThinkingDots agentIcon={AgentIcon} />}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {group.final && <LiveChatBubbleMemo message={group.final} agentIcon={AgentIcon} />}
      {group.tail.map(message => (
        <LiveChatBubbleMemo key={message.id} message={message} agentIcon={AgentIcon} />
      ))}
    </div>
  )
}

function InterruptedMarker() {
  return (
    <div
      className="flex items-center gap-3 py-1 text-[0.6rem] font-semibold tracking-[0.18em] text-red-600 uppercase"
      role="status"
    >
      <span className="h-px flex-1 border-t border-dashed border-red-600/60" aria-hidden="true" />
      <span className="whitespace-nowrap">User cancelled agent execution.</span>
      <span className="h-px flex-1 border-t border-dashed border-red-600/60" aria-hidden="true" />
    </div>
  )
}

export const TurnBlock = memo(TurnBlockImpl, (prev, next) => {
  if (prev.agentIcon !== next.agentIcon) return false
  if (prev.showThinkingDots !== next.showThinkingDots) return false
  if (prev.inFlight !== next.inFlight) return false
  if (prev.group.user !== next.group.user) return false
  if (prev.group.interrupted !== next.group.interrupted) return false
  if (prev.group.final !== next.group.final) return false
  if (prev.group.tail.length !== next.group.tail.length) return false
  if (prev.group.startedAt !== next.group.startedAt || prev.group.endedAt !== next.group.endedAt)
    return false
  if (prev.group.thinking.length !== next.group.thinking.length) return false
  if (prev.group.tail.some((message, index) => message !== next.group.tail[index])) return false
  return prev.group.thinking.every((message, index) => message === next.group.thinking[index])
})

function WorkedForBadge({
  startedAt,
  endedAt,
  inFlight,
}: {
  startedAt?: string
  endedAt?: string
  inFlight: boolean
}) {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (!inFlight) return
    setNowMs(Date.now())
    const id = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [inFlight])

  const workedFor = formatWorkedFor(startedAt, inFlight ? undefined : endedAt, nowMs)
  if (!workedFor) return null
  return (
    <span className="ml-auto text-[0.55rem] font-medium tabular-nums text-muted-foreground">
      {workedFor}
    </span>
  )
}

/** Cycles through WORKING_VERBS while active, settles on "Reasoning" when done. */
function CyclingVerb({ active }: { active: boolean }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * WORKING_VERBS.length))
  const [fading, setFading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const advance = useCallback(() => {
    setFading(true)
    // After the fade-out finishes, swap the word and fade back in
    setTimeout(() => {
      setIndex(prev => (prev + 1) % WORKING_VERBS.length)
      setFading(false)
    }, 400) // matches the CSS transition duration
  }, [])

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setFading(false)
      return
    }
    // Start cycling immediately
    advance()
    intervalRef.current = setInterval(advance, 4000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, advance])

  const label = active ? WORKING_VERBS[index] : 'Reasoning'

  return (
    <span
      className="text-[0.6rem] font-medium tracking-[0.14em] text-muted-foreground uppercase"
      style={{
        display: 'inline-block',
        minWidth: '5em',
        opacity: fading ? 0 : 1,
        transition: 'opacity 400ms ease',
      }}
    >
      {label}
      {active ? '...' : ''}
    </span>
  )
}

function ThinkingDots({ agentIcon: AgentIcon }: { agentIcon: ComponentType<{ size?: number }> }) {
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
  agentIcon: ComponentType<{ size?: number }>
  muted?: boolean
}) {
  if (message.role === 'system') {
    const isError = message.kind === 'error'
    const isCommand = message.kind === 'command'
    const isInterrupted = message.interruptedByUser === true

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

    if (isInterrupted) {
      return (
        <div className="px-1 py-1 text-center font-mono text-[0.68rem] leading-snug text-red-600/80">
          {message.body}
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

const LiveChatBubbleMemo = memo(LiveChatBubble, (prev, next) => {
  return (
    prev.agentIcon === next.agentIcon && prev.muted === next.muted && prev.message === next.message
  )
})

export function ChatBubble({
  message,
  agentIcon: AgentIcon,
}: {
  message: ChatMessage
  agentIcon: ComponentType<{ size?: number }>
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
