import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12">
      <section className="border border-border bg-card p-6 text-card-foreground sm:p-8">
        <p className="mb-2 text-[0.69rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          About
        </p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
          A small starter with room to grow.
        </h1>
        <p className="m-0 max-w-3xl text-base leading-8 text-muted-foreground">
          TanStack Start gives you type-safe routing, server functions, and modern SSR defaults. Use
          this as a clean foundation, then layer in your own routes, styling, and add-ons.
        </p>
      </section>
    </main>
  )
}
