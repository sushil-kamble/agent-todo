import { Spinner } from '#/shared/ui/spinner'

export function BoardLoadingState() {
  return (
    <section className="flex h-full min-h-0 w-full flex-1 self-stretch">
      <div className="relative flex h-full min-h-0 w-full flex-1 items-stretch">
        <div className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center overflow-hidden border-2 border-dashed border-border/80 bg-card/30 px-6 py-12 text-center backdrop-blur-[2px]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,color-mix(in_oklab,var(--primary)_8%,transparent),transparent_60%)] opacity-80" />

          <div
            role="status"
            aria-live="polite"
            className="relative mx-auto flex max-w-3xl flex-col items-center"
          >
            <Spinner className="size-12 text-primary" />
            <p className="mt-6 font-heading text-3xl leading-none tracking-tight text-foreground sm:text-4xl">
              Setting the board
            </p>
            <p className="mt-4 max-w-2xl text-base italic tracking-[0.01em] text-muted-foreground sm:text-xl">
              “The next move is taking shape.”
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
