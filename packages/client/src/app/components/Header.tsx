import { Link } from '@tanstack/react-router'
import { BrandLogo } from '#/app/components/BrandLogo'
import { useBoardDialogs } from '#/features/task-board/model/provider'
import { Button } from '#/shared/ui/button'

export function Header() {
  const { openCreateTaskDialog } = useBoardDialogs()
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-350 items-center justify-between px-8">
        <Link
          to="/"
          aria-label="Agent Todo home"
          className="group flex items-center text-foreground no-underline transition-opacity hover:opacity-90"
        >
          <BrandLogo />
        </Link>

        <nav className="flex items-center gap-6">
          <div className="hidden items-center gap-2 border border-border bg-card px-3 py-1.5 md:flex">
            <span className="size-1.5 animate-pulse bg-primary" />
            <span className="text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
              2 agents online
            </span>
          </div>
          <Button size="sm" onClick={() => openCreateTaskDialog()}>
            <span className="text-[0.68rem] tracking-[0.12em] uppercase">New task</span>
          </Button>
        </nav>
      </div>
    </header>
  )
}
