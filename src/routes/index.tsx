import {
  Funnel,
  MagnifyingGlass,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import { Board } from "#/components/board/Board";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/")({ component: BoardPage });

function BoardPage() {
  return (
    <div className="bg-paper relative flex h-[calc(100dvh-64px-57px)] w-full flex-col">
      {/* Board meta strip */}
      <div className="border-b border-border bg-background/60 backdrop-blur">
        <div className="mx-auto flex w-full max-w-350 items-end justify-between gap-6 px-8 pt-5 pb-4">
          <div>
            <p className="mb-1.5 flex items-center gap-2 text-[0.6rem] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              <span className="size-1.5 bg-primary" />
              workspace · default
            </p>
            <h1 className="font-heading text-4xl leading-[0.95] tracking-tight text-foreground">
              Today&apos;s{" "}
              <span className="italic text-muted-foreground">board.</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 pb-1">
            <div className="flex h-8 items-center gap-2 border border-border bg-card px-2.5 text-muted-foreground focus-within:border-foreground">
              <MagnifyingGlass size={13} />
              <input
                type="text"
                placeholder="Search tasks…"
                className="w-48 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <kbd className="border border-border bg-background px-1 text-[0.58rem] text-muted-foreground">
                /
              </kbd>
            </div>
            <Button size="sm" variant="outline" aria-label="Filter">
              <Funnel size={13} />
              <span className="text-[0.68rem] tracking-[0.12em] uppercase">
                Filter
              </span>
            </Button>
            <Button size="sm" variant="outline" aria-label="View options">
              <SlidersHorizontal size={13} />
            </Button>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="mx-auto flex w-full max-w-350 min-h-0 flex-1 flex-col px-8 py-5">
        <Board />
      </div>
    </div>
  );
}
