import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '#/components/ui/button'

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
    <div className="mx-auto w-full max-w-5xl px-4 pt-12 pb-16">
      <section className="mb-16 text-center">
        <p className="mb-4 text-[0.69rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
          Welcome
        </p>
        <h1 className="mx-auto mb-5 max-w-2xl text-4xl leading-tight font-bold tracking-tight text-foreground sm:text-5xl">
          Your headline goes here
        </h1>
        <p className="mx-auto mb-8 max-w-md text-base leading-relaxed text-muted-foreground">
          A short supporting sentence that gives context. Replace this with something real once
          you&apos;re ready.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" nativeButton={false} render={<Link to="/about">Primary action</Link>} />
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link to="/">Secondary action</Link>}
          />
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {placeholders.map(({ kicker, title, desc }) => (
          <div
            key={title}
            className="flex flex-col gap-2.5 border border-border bg-card p-7 text-card-foreground"
          >
            <p className="text-[0.69rem] font-bold tracking-[0.16em] text-muted-foreground uppercase">
              {kicker}
            </p>
            <h3 className="text-base font-bold tracking-tight">{title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
