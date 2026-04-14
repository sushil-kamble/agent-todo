import {
  ArchiveIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { BrandLogo } from '#/app/components/BrandLogo'
import { useTheme } from '#/features/theme/model/theme'
import { Button } from '#/shared/ui/button'

type AppTopBarProps = {
  addLabel: string
  backlogActive?: boolean
  backlogCount: number
  onAddTask: () => void
  searchPlaceholder: string
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function AppTopBar({
  addLabel,
  backlogActive = false,
  backlogCount,
  onAddTask,
  searchPlaceholder,
  searchQuery,
  setSearchQuery,
}: AppTopBarProps) {
  const { theme, toggleTheme } = useTheme()
  const searchRef = useRef<HTMLInputElement>(null)
  const homeActive = !backlogActive

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== '/') return
      const target = event.target as HTMLElement
      const tag = target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="mx-auto flex h-14 w-full max-w-350 items-center justify-between px-8">
        <Link
          to="/"
          aria-label="Agent Todo home"
          className="flex items-center text-foreground no-underline transition-opacity hover:opacity-90"
        >
          <BrandLogo size="sm" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-pressed={theme === 'dark'}
            className="flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground hover:border-foreground/60 hover:bg-background hover:text-foreground"
          >
            {theme === 'dark' ? (
              <SunIcon size={14} weight="regular" />
            ) : (
              <MoonIcon size={14} weight="regular" />
            )}
          </button>

          <Link
            to="/"
            className={[
              'flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors',
              homeActive
                ? 'border-primary bg-primary text-primary-foreground shadow-primary-hard'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/6 hover:text-foreground',
            ].join(' ')}
          >
            <HouseIcon size={13} weight="bold" />
            <span>Home</span>
          </Link>

          <Link
            to="/backlogs"
            className={[
              'flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors',
              backlogActive
                ? 'border-primary bg-primary text-primary-foreground shadow-primary-hard'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/6 hover:text-foreground',
            ].join(' ')}
          >
            <ArchiveIcon size={13} weight="bold" />
            <span>Backlogs ({backlogCount})</span>
          </Link>

          <div className="flex h-8 items-center gap-2 border border-border bg-card px-2.5 text-muted-foreground focus-within:border-foreground/60 focus-within:bg-background">
            <MagnifyingGlassIcon size={13} weight="regular" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={searchPlaceholder}
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

          <Button size="sm" onClick={onAddTask}>
            <PlusIcon size={13} />
            <span className="text-xs">{addLabel}</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
