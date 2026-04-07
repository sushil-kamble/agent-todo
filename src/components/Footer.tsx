import { Link } from '@tanstack/react-router'

const footerLinks = [
  { kind: 'internal' as const, label: 'Home', to: '/' as const },
  { kind: 'internal' as const, label: 'About', to: '/about' as const },
  { kind: 'external' as const, label: 'Contact', href: 'mailto:hello@acme.test' },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5">
        <span className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Acme. All rights reserved.
        </span>
        <nav className="flex gap-5">
          {footerLinks.map((link) => {
            if (link.kind === 'internal') {
              return (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-xs text-muted-foreground no-underline hover:text-foreground"
                >
                  {link.label}
                </Link>
              )
            }
            return (
              <a
                key={link.label}
                href={link.href}
                className="text-xs text-muted-foreground no-underline hover:text-foreground"
              >
                {link.label}
              </a>
            )
          })}
        </nav>
      </div>
    </footer>
  )
}
