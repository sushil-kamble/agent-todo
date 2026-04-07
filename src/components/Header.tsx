import { Link } from '@tanstack/react-router'
import { useBoard } from '#/components/board/store'
import { Button } from '#/components/ui/button'

/**
 * Stylized "A" mark — two angled strokes with a crossbar, framed in a square.
 * This is the webapp's symbol.
 */
function AgentMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex size-8 items-center justify-center border border-foreground bg-foreground text-background ${className}`}
      aria-hidden="true"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
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

export function Header() {
  const { openNewTask } = useBoard()
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-8">
        <Link to="/" className="group flex items-center gap-3 text-foreground no-underline">
          <AgentMark />
          <div className="flex flex-col leading-none">
            <span className="font-heading text-xl tracking-tight text-foreground">
              Agent<span className="italic text-muted-foreground">todo</span>
            </span>
            <span className="mt-0.5 text-[0.6rem] font-medium tracking-[0.22em] text-muted-foreground uppercase">
              orchestrate · delegate · ship
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-6">
          <div className="hidden items-center gap-2 border border-border bg-card px-3 py-1.5 md:flex">
            <span className="size-1.5 animate-pulse bg-primary" />
            <span className="text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              2 agents online
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => openNewTask('todo')}>
            <span className="text-[0.68rem] tracking-[0.12em] uppercase">New task</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}
