import { Link, useRouterState } from '@tanstack/react-router'

function AgentMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`relative inline-flex size-6 items-center justify-center border border-foreground bg-foreground text-background ${className}`}
      aria-hidden="true"
    >
      <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
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
      <span className="pointer-events-none absolute -right-0.75 -bottom-0.75 size-1 bg-primary" />
    </span>
  )
}

export function Footer() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isAboutPage = pathname === '/about'

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-350 flex-wrap items-center justify-between gap-3 px-8 py-3">
        {/* Logo + wordmark — mirrors the header */}
        <div className="flex items-center gap-2.5">
          <AgentMark />
          <span className="font-heading text-sm tracking-tight text-foreground">
            Agent<span className="italic text-muted-foreground">todo</span>
          </span>
        </div>

        {/* Keyboard shortcuts */}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
            <span className="flex items-center gap-1.5">
              <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                N
              </kbd>
              new task
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                /
              </kbd>
              search
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                V
              </kbd>
              cycle view
            </span>
          </div>
          <Link
            to={isAboutPage ? '/' : '/about'}
            className="inline-flex h-8 items-center border border-border bg-card px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/60 hover:bg-background"
          >
            <span>{isAboutPage ? 'Home' : 'About'}</span>
          </Link>
        </div>
      </div>
    </footer>
  )
}
