import { Link, useRouterState } from '@tanstack/react-router'
import { BrandLogo } from '#/app/components/BrandLogo'

export function Footer() {
  const pathname = useRouterState({ select: state => state.location.pathname })
  const isAboutPage = pathname === '/about'
  const showShortcuts = pathname === '/'

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-350 flex-wrap items-center justify-between gap-3 px-8 py-3">
        <Link
          to="/"
          aria-label="agentodo home"
          className="flex items-center text-foreground no-underline transition-opacity hover:opacity-90"
        >
          <BrandLogo size="sm" />
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {showShortcuts ? (
            <div className="flex flex-wrap items-center justify-end gap-5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
              <span className="flex items-center gap-1.5">
                <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                  N
                </kbd>
                new task
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                  B
                </kbd>
                open backlog
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
                  /
                </kbd>
                search
              </span>
            </div>
          ) : null}
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
