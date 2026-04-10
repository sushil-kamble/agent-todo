import { MagnifyingGlassIcon, PlusIcon, XIcon } from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { Board } from '#/components/board/Board'
import { Button } from '#/components/ui/button'
import { useBoardDialogs, useBoardSearch } from '#/stores/board'

export const Route = createFileRoute('/')({ component: BoardPage })

function AgentMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex size-7 shrink-0 items-center justify-center border border-foreground bg-foreground text-background ${className}`}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
        <title>Agent Todo mark</title>
        <path
          d="M2.2 15.5 L9 2.5 L15.8 15.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d="M5.2 10.8 L12.8 10.8"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="square"
        />
      </svg>
      <span className="pointer-events-none absolute -right-[3px] -bottom-[3px] size-1.5 bg-primary" />
    </span>
  )
}

function BoardPage() {
  const { openNewTask } = useBoardDialogs()
  const { searchQuery, setSearchQuery } = useBoardSearch()
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable)
        return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex h-full flex-col">
      {/* Unified top bar */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-350 items-center justify-between px-8">
          <Link to="/" className="flex items-center gap-2.5 text-foreground no-underline">
            <AgentMark />
            <span className="font-heading text-[1.25rem] leading-none tracking-tight">
              Agent<span className="italic text-muted-foreground">todo</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <div className="flex h-8 items-center gap-2 border border-border bg-card px-2.5 text-muted-foreground focus-within:border-foreground/60 focus-within:bg-background">
              <MagnifyingGlassIcon size={13} weight="regular" />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks…"
                className="w-48 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="flex h-4 w-4 items-center justify-center text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <XIcon size={12} weight="bold" />
                </button>
              ) : (
                <kbd className="border border-border bg-background px-1 text-[0.58rem] text-muted-foreground">
                  /
                </kbd>
              )}
            </div>
            <Button size="sm" variant="outline" onClick={() => openNewTask('todo')}>
              <PlusIcon size={13} />
              <span className="text-xs">Add task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="bg-paper min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex h-full w-full max-w-350 flex-col px-8 py-5">
          <Board />
        </div>
      </div>
    </div>
  )
}
