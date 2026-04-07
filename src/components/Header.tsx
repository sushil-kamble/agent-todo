import { Link } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'

const navLinks = [
  { to: '/' as const, label: 'Home' },
  { to: '/about' as const, label: 'About' },
]

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 text-foreground no-underline">
          <span className="flex size-7 items-center justify-center bg-primary text-primary-foreground">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-labelledby="site-logo-title"
              role="img"
            >
              <title id="site-logo-title">Acme logo</title>
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2" fill="currentColor" />
            </svg>
          </span>
          <span className="text-sm font-bold tracking-tight">Acme</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground no-underline hover:text-foreground"
              activeProps={{ className: 'text-foreground' }}
            >
              {label}
            </Link>
          ))}
          <Button size="sm" nativeButton={false} render={<Link to="/about">Get started</Link>} />
        </nav>
      </div>
    </header>
  )
}
