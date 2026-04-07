import { Link } from '@tanstack/react-router'

const footerLinks = [
  { kind: 'internal' as const, label: 'Home', to: '/' as const },
  { kind: 'internal' as const, label: 'About', to: '/about' as const },
  { kind: 'external' as const, label: 'Contact', href: 'mailto:hello@acme.test' },
]

export function Footer() {
  return (
    <footer className="site-footer">
      <div
        className="page-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          padding: "20px 0",
        }}
      >
        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--sea-ink-soft)",
          }}
        >
          © {new Date().getFullYear()} Acme. All rights reserved.
        </span>

        <nav style={{ display: "flex", gap: "20px" }}>
          {footerLinks.map(link => {
            const linkStyle = {
              fontSize: '0.8rem',
              color: 'var(--sea-ink-soft)',
              textDecoration: 'none',
            } as const

            if (link.kind === 'internal') {
              return (
                <Link key={link.label} to={link.to} style={linkStyle}>
                  {link.label}
                </Link>
              )
            }

            return (
              <a key={link.label} href={link.href} style={linkStyle}>
                {link.label}
              </a>
            )
          })}
        </nav>
      </div>
    </footer>
  )
}
