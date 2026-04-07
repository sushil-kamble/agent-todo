import { Link } from '@tanstack/react-router'

const navLinks = [
  { to: '/' as const, label: 'Home' },
  { to: '/about' as const, label: 'About' },
]

export function Header() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "var(--header-bg)",
        borderBottom: "1px solid var(--line)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div
        className="page-wrap"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
        }}
      >
        {/* Logo */}
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            textDecoration: "none",
          }}
        >
          <span
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "7px",
              background: "linear-gradient(135deg, var(--lagoon), var(--palm))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-labelledby="site-logo-title"
              role="img"
            >
              <title id="site-logo-title">Acme logo</title>
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2" fill="white" />
            </svg>
          </span>
          <span
            className="display-title"
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--sea-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Acme
          </span>
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="nav-link"
              activeProps={{ className: "nav-link is-active" }}
              style={{
                padding: "6px 12px",
                fontSize: "0.85rem",
                fontWeight: 500,
                borderRadius: "6px",
              }}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/about"
            style={{
              marginLeft: "8px",
              padding: "6px 14px",
              fontSize: "0.82rem",
              fontWeight: 600,
              borderRadius: "6px",
              background: "var(--lagoon)",
              color: "white",
              textDecoration: "none",
              border: "1px solid transparent",
              letterSpacing: "0.01em",
            }}
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  )
}
