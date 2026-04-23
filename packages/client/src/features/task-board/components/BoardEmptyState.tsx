import { useBoardDialogs } from '#/features/task-board/model'
import { Button } from '#/shared/ui/button'

export function BoardEmptyState() {
  const { openCreateTaskDialog } = useBoardDialogs()

  return (
    <section className="flex h-full min-h-0 w-full flex-1 self-stretch">
      <div className="relative flex h-full min-h-0 w-full flex-1 items-stretch">
        <div className="flex h-full min-h-0 w-full flex-1 items-center justify-center border-2 border-dashed border-border/80 bg-card/30 px-6 py-12 text-center backdrop-blur-[2px]">
          <div className="mx-auto flex max-w-3xl flex-col items-center">
            <h2 className="max-w-4xl font-heading text-3xl leading-[1.05] tracking-tight text-foreground sm:text-5xl">
              Pick the one task that matters most.
            </h2>
            <p className="mt-5 text-sm italic tracking-[0.02em] text-muted-foreground sm:text-base">
              &quot;The fastest way to build momentum is to begin.&quot;
            </p>
            <Button size="lg" className="mt-8 min-w-42" onClick={() => openCreateTaskDialog()}>
              <span>Create first task</span>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
