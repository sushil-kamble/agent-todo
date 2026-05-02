import { useEffect, useState } from 'react'
import { BrandLogo } from '#/app/components/BrandLogo'

const BOARD_QUOTES = [
  'The next move is taking shape.',
  'Plans hum quietly before they ship.',
  'Small commits, large compounding.',
  'A clear board is a clear mind.',
  'Cadence beats intensity.',
  'Ship the smallest thing that matters.',
  'The board remembers every move.',
  'Discipline is choosing what to delete.',
  'Sharpen the axe before the cut.',
  'One percent, every single day.',
] as const

const SPLASH_KEYFRAMES = `
  @keyframes splash-shimmer {
    0% { transform: translateX(-110%); }
    100% { transform: translateX(310%); }
  }
  @keyframes splash-glow {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50% { opacity: 0.95; transform: scale(1.04); }
  }
  @keyframes splash-rise {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    [data-splash-anim] {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }
`

export function BoardLoadingState() {
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    setQuote(BOARD_QUOTES[Math.floor(Math.random() * BOARD_QUOTES.length)])
  }, [])

  return (
    <section className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-background">
      <style>{SPLASH_KEYFRAMES}</style>

      <div className="bg-grid pointer-events-none absolute inset-0 opacity-70" />

      <div
        data-splash-anim
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_16%,transparent),transparent_62%)]"
        style={{
          animation: 'splash-glow 3.2s ease-in-out infinite',
          willChange: 'opacity, transform',
        }}
      />

      <div
        role="status"
        aria-live="polite"
        aria-label="Loading board"
        className="relative mx-auto flex max-w-3xl flex-col items-center px-6 text-center"
      >
        <div
          data-splash-anim
          style={{
            opacity: 0,
            animation: 'splash-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
            willChange: 'transform, opacity',
          }}
        >
          <div>
            <BrandLogo size="splash" />
          </div>
        </div>

        <p
          data-splash-anim
          className="mt-8 font-heading text-lg leading-none tracking-[0.035em] text-muted-foreground uppercase sm:text-xl"
          style={{
            opacity: 0,
            animation: 'splash-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 140ms both',
          }}
        >
          Local-first kanban for AI agents
        </p>

        <div
          data-splash-anim
          className="relative mt-7 h-[2px] w-72 overflow-hidden bg-border"
          style={{
            opacity: 0,
            animation: 'splash-rise 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 240ms both',
          }}
        >
          <div
            className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-primary to-transparent"
            style={{
              animation: 'splash-shimmer 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              willChange: 'transform',
            }}
          />
        </div>

        <p
          data-splash-anim
          className="mt-7 max-w-2xl font-heading text-xl italic tracking-[0.005em] text-muted-foreground sm:text-2xl"
          style={{
            opacity: 0,
            animation: 'splash-rise 800ms cubic-bezier(0.2, 0.8, 0.2, 1) 360ms both',
            minHeight: '1.75em',
          }}
        >
          {quote ? <>&ldquo;{quote}&rdquo;</> : null}
        </p>
      </div>
    </section>
  )
}
