import {
  ArchiveIcon,
  ArrowRightIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CodeIcon,
  FolderOpenIcon,
  GaugeIcon,
  GithubLogoIcon,
  HardDrivesIcon,
  KanbanIcon,
  ListDashesIcon,
  MagnifyingGlassIcon,
  PlayIcon,
  PulseIcon,
  RobotIcon,
  ScrollIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Fragment } from 'react'
import { AppTopBar } from '#/app/components/AppTopBar'
import { useBoardTasks } from '#/features/task-board/model'
import { ClaudeIcon } from '#/shared/ui/icons'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  const { tasks } = useBoardTasks()

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        backlogCount={tasks.backlog?.length ?? 0}
        showAddTask={false}
        showHomeCta
        showSearch={false}
      />

      <div className="bg-paper min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-350 flex-col gap-20 px-8 py-14 sm:py-20">
          <Hero />
          <Pipeline />
          <FeatureBento />
          <AgentsAndModes />
          <FinalCta />
        </main>
      </div>
    </div>
  )
}

/* ------------------------------- HERO ------------------------------- */

function Hero() {
  return (
    <header className="flex flex-col gap-8">
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_minmax(20rem,0.88fr)]">
        <div className="flex flex-col gap-6">
          <h1 className="font-heading text-4xl leading-[1.02] tracking-tight text-foreground sm:text-[3.35rem] lg:text-[4.4rem]">
            The board for the work
            <br />
            you hand to <span className="font-logo text-primary">agents</span>.
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
            Turn a coding prompt into a task, assign the right agent, and review the run from the
            same card.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="group inline-flex items-center gap-2 border border-primary bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-primary-hard-lg transition-transform hover:-translate-y-px hover:translate-x-px"
            >
              Open Task Board
              <ArrowRightIcon
                size={14}
                weight="bold"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <a
              href="https://github.com/sushil-kamble/agent-todo"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/50 hover:bg-background"
            >
              <GithubLogoIcon size={16} weight="fill" />
              Source Code
            </a>
          </div>
        </div>

        <HeroCardMock />
      </div>
    </header>
  )
}

function HeroCardMock() {
  return (
    <div className="relative w-full max-w-[35rem] self-stretch justify-self-end">
      <span className="pointer-events-none absolute -top-2 -left-2 size-3 border-t-2 border-l-2 border-primary" />
      <span className="pointer-events-none absolute -right-2 -bottom-2 size-3 border-r-2 border-b-2 border-primary" />

      <div className="relative flex flex-col border border-border bg-card/80 shadow-primary-hard backdrop-blur-[2px]">
        <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="text-[0.58rem] tracking-[0.18em] uppercase">TASK-042</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 border border-border bg-background px-1.5 py-0.75 text-[0.56rem] font-semibold tracking-[0.08em] text-foreground uppercase">
              <CodeIcon size={9} weight="bold" />
              Code
            </span>
            <span className="inline-flex items-center border border-primary bg-primary px-1.5 py-0.75 text-[0.56rem] font-semibold tracking-[0.08em] text-primary-foreground uppercase">
              Feature
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="pointer-events-none absolute inset-y-px left-px w-1 animate-pulse bg-primary" />
          <h3 className="font-heading text-sm leading-snug tracking-tight text-foreground">
            Refactor the authentication middleware and add session rotation tests.
          </h3>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-dashed border-border px-3 py-2 text-[0.58rem] tracking-widest text-muted-foreground uppercase">
          <span className="inline-flex items-center gap-1">
            <FolderOpenIcon size={11} weight="duotone" />
            ~/apps/web-core
          </span>
          <span className="inline-flex items-center gap-1 border border-primary bg-primary px-1 py-0.5 text-[0.54rem] text-primary-foreground">
            <ClaudeIcon size={9} />
            Opus · High
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-background/60 px-3 py-1.5 text-[0.6rem] tracking-[0.12em] text-muted-foreground uppercase">
          <span className="inline-flex items-center gap-1.5">
            <PulseIcon size={11} weight="bold" className="animate-pulse text-primary" />
            Agent running
          </span>
          <span className="tabular-nums">00:04:12</span>
        </div>
      </div>
    </div>
  )
}

/* ----------------------------- PIPELINE ----------------------------- */

type PipelineStep = {
  id: string
  label: string
  hint: string
  icon: React.ReactNode
  accent: string
}

const pipelineSteps: PipelineStep[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    hint: 'Capture rough ideas',
    icon: <ArchiveIcon size={14} weight="duotone" />,
    accent: 'bg-muted-foreground',
  },
  {
    id: 'todo',
    label: 'Todo',
    hint: 'Shape it. Pick an agent.',
    icon: <ListDashesIcon size={14} weight="duotone" />,
    accent: 'bg-foreground',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    hint: 'Agent is working',
    icon: <PlayIcon size={14} weight="duotone" />,
    accent: 'bg-primary',
  },
  {
    id: 'done',
    label: 'Completed',
    hint: 'Review & archive',
    icon: <CheckCircleIcon size={14} weight="duotone" />,
    accent: 'bg-muted-foreground',
  },
]

function Pipeline() {
  return (
    <section className="flex flex-col gap-6">
      <SectionEyebrow label="The Flow" />
      <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
        From a half-formed idea to a reviewed diff —{' '}
        <span className="text-muted-foreground">on one board.</span>
      </h2>

      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch lg:gap-0">
        {pipelineSteps.map((step, index) => (
          <Fragment key={step.id}>
            <PipelineCard step={step} index={index} />
            {index < pipelineSteps.length - 1 ? (
              <div
                className="hidden items-center justify-center px-2 text-muted-foreground lg:flex"
                aria-hidden="true"
              >
                <CaretRightIcon size={14} weight="bold" />
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
    </section>
  )
}

function PipelineCard({ step, index }: { step: PipelineStep; index: number }) {
  return (
    <div className="group/step relative flex flex-col gap-2 border border-border bg-card/50 px-4 py-4 transition-colors hover:border-foreground/30 hover:bg-card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className={`size-2 ${step.accent}`} />
          <span className="text-[0.6rem] font-medium tracking-[0.18em] uppercase">
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <span className="text-muted-foreground">{step.icon}</span>
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-lg leading-none text-foreground">{step.label}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{step.hint}</p>
      </div>
      <span className="pointer-events-none absolute top-0 right-0 size-2 border-t-2 border-r-2 border-foreground/0 transition-colors group-hover/step:border-primary" />
    </div>
  )
}

/* --------------------------- FEATURE BENTO --------------------------- */

function FeatureBento() {
  return (
    <section className="flex flex-col gap-6">
      <SectionEyebrow label="Why it's different" />
      <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
        Not a chat window.
        <br className="sm:hidden" /> A workbench.
      </h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <FeatureCard
          className="sm:col-span-4"
          icon={<HardDrivesIcon size={18} weight="duotone" />}
          title="Runs on your filesystem"
          description="Agents read and edit directly inside the local project directory you pick — no cloud mirror, no paste-the-file workflow. Tasks without a project fall back to a safe scratch workspace."
        />
        <FeatureCard
          className="sm:col-span-2"
          icon={<KanbanIcon size={18} weight="duotone" />}
          title="Kanban, not chat"
          description="Backlog · Todo · In Progress · Completed. Every task has a home."
        />

        <FeatureCard
          className="sm:col-span-2"
          icon={<RobotIcon size={18} weight="duotone" />}
          title="Claude Code + Codex"
          description="Pick the agent per task. Swap models and reasoning effort without leaving the card."
        />
        <FeatureCard
          className="sm:col-span-2"
          icon={<GaugeIcon size={18} weight="duotone" />}
          title="Dial in the effort"
          description="Low → Max, plus Fast mode. Each task carries its own model, effort, and task type."
        />
        <FeatureCard
          className="sm:col-span-2"
          icon={<CodeIcon size={18} weight="duotone" />}
          title="Ask or Code"
          description="Read-only analysis for scoping. Implementation mode when you're ready to ship."
        />

        <FeatureCard
          className="sm:col-span-3"
          icon={<TerminalWindowIcon size={18} weight="duotone" />}
          title="Live run console"
          description="Watch the agent think, call tools, and run shell commands in real time — or come back to the full transcript later."
        />
        <FeatureCard
          className="sm:col-span-3"
          icon={<ScrollIcon size={18} weight="duotone" />}
          title="Every run, archived"
          description="Runs stay attached to their task. Follow up on the same thread, re-run with a tweak, or move the card to Completed when it's shipped."
        />
      </div>
    </section>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  className = '',
}: {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={`group/feat relative flex flex-col gap-3 border border-border bg-card/40 p-5 transition-colors hover:border-foreground/30 hover:bg-card sm:p-6 ${className}`}
    >
      <div className="flex size-9 items-center justify-center border border-border bg-background text-foreground">
        {icon}
      </div>
      <h3 className="font-heading text-base leading-snug tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="pointer-events-none absolute top-0 right-0 size-2 border-t-2 border-r-2 border-foreground/0 transition-colors group-hover/feat:border-primary" />
    </div>
  )
}

/* ------------------------ AGENTS & MODES STRIP ------------------------ */

function AgentsAndModes() {
  return (
    <section className="flex flex-col gap-6">
      <SectionEyebrow label="Modes" />
      <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
        Two ways to brief an agent.
      </h2>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ModeCard
          tag="Ask mode"
          icon={<MagnifyingGlassIcon size={16} weight="duotone" />}
          title="Investigate without touching the tree."
          bullets={[
            'Trace how a subsystem works',
            'Audit code before a refactor',
            'Compare two approaches side by side',
          ]}
        />
        <ModeCard
          tag="Code mode"
          icon={<CodeIcon size={16} weight="duotone" />}
          title="Ship changes with a full paper trail."
          bullets={[
            'Refactor a module end-to-end',
            'Add tests to a failing suite',
            'Implement a feature from a spec',
          ]}
          emphasis
        />
      </div>
    </section>
  )
}

function ModeCard({
  tag,
  icon,
  title,
  bullets,
  emphasis = false,
}: {
  tag: string
  icon: React.ReactNode
  title: string
  bullets: string[]
  emphasis?: boolean
}) {
  return (
    <div
      className={[
        'relative flex flex-col gap-4 border bg-card/40 p-5 transition-colors sm:p-6',
        emphasis
          ? 'border-primary/40 hover:border-primary/70 hover:bg-card'
          : 'border-border hover:border-foreground/30 hover:bg-card',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span
          className={[
            'inline-flex size-7 items-center justify-center border',
            emphasis
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-foreground',
          ].join(' ')}
        >
          {icon}
        </span>
        <span className="text-[0.6rem] font-medium tracking-[0.18em] text-muted-foreground uppercase">
          {tag}
        </span>
      </div>
      <h3 className="font-heading text-lg leading-snug tracking-tight text-foreground">{title}</h3>
      <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
        {bullets.map(bullet => (
          <li key={bullet} className="flex items-start gap-2">
            <CaretRightIcon
              size={11}
              weight="bold"
              className={`mt-1.5 shrink-0 ${emphasis ? 'text-primary' : 'text-muted-foreground/60'}`}
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------ FINAL CTA ------------------------------ */

function FinalCta() {
  return (
    <section className="relative border border-border bg-card/60 p-8 sm:p-12">
      <span className="pointer-events-none absolute -top-px -left-px size-4 border-t-2 border-l-2 border-primary" />
      <span className="pointer-events-none absolute -right-px -bottom-px size-4 border-r-2 border-b-2 border-primary" />

      <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6rem] tracking-[0.22em] text-muted-foreground uppercase">
            Ready when you are
          </span>
          <h2 className="font-heading text-2xl leading-tight tracking-tight text-foreground sm:text-3xl">
            Queue your first task. <span className="font-logo text-primary">Let it run.</span>
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 border border-primary bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-primary-hard transition-transform hover:-translate-y-px hover:translate-x-px"
          >
            Open Task Board
            <ArrowRightIcon
              size={14}
              weight="bold"
              className="transition-transform group-hover:translate-x-1"
            />
          </Link>
          <a
            href="https://github.com/sushil-kamble/agent-todo"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/50"
          >
            <GithubLogoIcon size={16} weight="fill" />
            View on GitHub
          </a>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-dashed border-border pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>Show some love for the project and follow along on GitHub.</span>
        <a
          href="https://github.com/sushil-kamble/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          <GithubLogoIcon size={15} weight="fill" />
          Follow on GitHub
        </a>
      </div>
    </section>
  )
}

/* ------------------------------ HELPERS ------------------------------ */

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[0.6rem] tracking-[0.22em] text-muted-foreground uppercase">
      <span>{label}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}
