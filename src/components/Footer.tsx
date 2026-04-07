export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-8 py-4">
        <div className="flex items-center gap-3 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
          <span className="size-1.5 bg-primary" />
          <span>
            © {new Date().getFullYear()} Agent<span className="text-foreground">todo</span>
          </span>
          <span className="text-border">/</span>
          <span>v0.1.0</span>
        </div>

        <div className="flex items-center gap-5 text-[0.68rem] tracking-[0.14em] text-muted-foreground uppercase">
          <span className="flex items-center gap-1.5">
            <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
              N
            </kbd>
            new task
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
              /
            </kbd>
            search
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="border border-border bg-card px-1.5 py-0.5 text-[0.6rem] font-medium text-foreground normal-case">
              ?
            </kbd>
            help
          </span>
        </div>
      </div>
    </footer>
  )
}
