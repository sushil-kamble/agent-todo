import { Check, X } from '@phosphor-icons/react'
import { ClaudeIcon, OpenAIIcon } from '#/components/icons'
import { Button } from '#/components/ui/button'
import type { TaskCard } from '../types'
import { MOCK_DONE_CHAT } from './constants'
import { ChatBubble, ProjectPathChip } from './shared'

export function ReadonlyPanel({ task, close }: { task: TaskCard; close: () => void }) {
  const AgentIcon = task.agent === 'claude' ? ClaudeIcon : OpenAIIcon
  const agentLabel = task.agent === 'claude' ? 'Claude' : 'Codex'

  return (
    <section className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:max-h-[calc(100vh-3rem)]">
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
        <div className="space-y-3 px-5 py-4">
          <div className="mb-2 text-[0.58rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Transcript
          </div>
          {MOCK_DONE_CHAT.map(m => (
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
