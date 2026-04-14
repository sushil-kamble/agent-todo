import { cn } from '#/shared/lib/utils'

type BrandLogoProps = {
  className?: string
  size?: 'sm' | 'md'
}

export function BrandLogo({ className, size = 'md' }: BrandLogoProps) {
  const compact = size === 'sm'

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center border border-foreground bg-card text-foreground',
        compact ? 'size-10' : 'size-12',
        className
      )}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-0.5 border border-foreground/10" />
      <svg
        className={cn(
          'pointer-events-none relative z-10 overflow-visible',
          compact ? 'size-[2.45rem]' : 'size-[2.8rem]'
        )}
        viewBox="0 0 100 100"
        fill="none"
      >
        <title>Agent Todo logo</title>
        <text
          x="49"
          y="68"
          fontSize={compact ? '70' : '76'}
          textAnchor="middle"
          fill="currentColor"
          className="font-logo"
        >
          A
        </text>
        <path
          d="M24 67.5C35 74.8 51 76.8 67 71.6C72.6 69.8 77.7 66.8 82 63.1"
          stroke="var(--primary)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M39.5 47.8C45.2 44.4 52.8 43.8 59.8 46.1"
          stroke="var(--primary)"
          strokeWidth="2.7"
          strokeLinecap="round"
          opacity="0.85"
        />
      </svg>
    </span>
  )
}
