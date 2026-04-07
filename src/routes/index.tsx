import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

const placeholders = [
  {
    kicker: 'Feature One',
    title: 'Placeholder block',
    desc: 'This area is reserved for your first content section. Drop in whatever belongs here.',
  },
  {
    kicker: 'Feature Two',
    title: 'Another placeholder',
    desc: 'A second content area. Use this for highlights, stats, or a key message.',
  },
  {
    kicker: 'Feature Three',
    title: 'And one more',
    desc: 'Third section placeholder - ready for real content whenever you are.',
  },
]

function Home() {
  return (
    <div className="page-wrap" style={{ paddingTop: "48px", paddingBottom: "64px" }}>
      {/* Hero placeholder */}
      <section style={{ textAlign: "center", marginBottom: "64px" }}>
        <p className="island-kicker" style={{ marginBottom: "16px" }}>
          Welcome
        </p>
        <h1
          className="display-title"
          style={{
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 700,
            color: "var(--sea-ink)",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            margin: "0 auto 20px",
            maxWidth: "640px",
          }}
        >
          Your headline goes here
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            color: "var(--sea-ink-soft)",
            maxWidth: "480px",
            margin: "0 auto 32px",
            lineHeight: 1.65,
          }}
        >
          A short supporting sentence that gives context. Replace this with something real once you're ready.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/about"
            style={{
              padding: "10px 22px",
              borderRadius: "7px",
              background: "var(--lagoon)",
              color: "white",
              fontWeight: 600,
              fontSize: "0.9rem",
              textDecoration: "none",
            }}
          >
            Primary action
          </Link>
          <Link
            to="/"
            style={{
              padding: "10px 22px",
              borderRadius: "7px",
              border: "1px solid var(--line)",
              background: "var(--surface)",
              color: "var(--sea-ink)",
              fontWeight: 500,
              fontSize: "0.9rem",
              textDecoration: "none",
              backdropFilter: "blur(4px)",
            }}
          >
            Secondary action
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "20px",
        }}
      >
        {placeholders.map(({ kicker, title, desc }) => (
          <div
            key={title}
            className="island-shell feature-card"
            style={{
              borderRadius: "12px",
              padding: "28px",
              border: "1px solid var(--line)",
              cursor: "default",
            }}
          >
            <p className="island-kicker" style={{ marginBottom: "12px" }}>
              {kicker}
            </p>
            <h3
              style={{
                fontSize: "1.05rem",
                fontWeight: 700,
                color: "var(--sea-ink)",
                margin: "0 0 10px",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: "0.875rem",
                color: "var(--sea-ink-soft)",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {desc}
            </p>
          </div>
        ))}
      </section>
    </div>
  )
}
