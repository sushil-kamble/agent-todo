import { useEffect, useState, type ComponentType } from 'react'
import {
  CaretRight,
  Check,
  CopySimple,
  Folder,
  X,
} from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '#/components/ui/collapsible'
import { WORKING_VERBS } from './constants'
import { MD_COMPONENTS } from './markdown'
import type { ChatMessage, LiveMessage, TurnGroup } from './types'

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
        <X size={12} weight="bold" />
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

export function TurnBlock({
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
  const hasThinking = group.thinking.length > 0 || showThinkingDots || inFlight
  const thinkingCount = group.thinking.length

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
            {inFlight ? (
              <WorkingLabel />
            ) : (
              <span className="text-[0.6rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
                Trace
              </span>
            )}
            {thinkingCount > 0 && (
              <span className="ml-auto border border-border bg-background px-1.5 text-[0.55rem] font-medium tabular-nums text-muted-foreground">
                {thinkingCount}
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

function WorkingLabel() {
  const [verb, setVerb] = useState(
    () => WORKING_VERBS[Math.floor(Math.random() * WORKING_VERBS.length)]
  )

  useEffect(() => {
    const id = window.setInterval(() => {
      setVerb(prev => {
        let next = prev
        while (next === prev) {
          next = WORKING_VERBS[Math.floor(Math.random() * WORKING_VERBS.length)]
        }
        return next
      })
    }, 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <span className="inline-flex items-center gap-0.5 text-[0.62rem] font-medium tracking-[0.14em] text-foreground uppercase">
      <span className="animate-pulse">{verb}</span>
      <span className="inline-flex gap-px" aria-hidden="true">
        <span
          className="animate-pulse text-foreground"
          style={{ animationDelay: '0ms', animationDuration: '1.2s' }}
        >
          .
        </span>
        <span
          className="animate-pulse text-foreground"
          style={{ animationDelay: '200ms', animationDuration: '1.2s' }}
        >
          .
        </span>
        <span
          className="animate-pulse text-foreground"
          style={{ animationDelay: '400ms', animationDuration: '1.2s' }}
        >
          .
        </span>
      </span>
    </span>
  )
}

function ThinkingDots({
  agentIcon: AgentIcon,
}: {
  agentIcon: ComponentType<{ size?: number }>
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

export function LiveChatBubble({
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
