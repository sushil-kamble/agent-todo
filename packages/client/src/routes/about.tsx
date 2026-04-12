import {
  ArrowRightIcon,
  GithubLogoIcon,
  HardDrivesIcon,
  KanbanIcon,
  RobotIcon,
  TerminalWindowIcon,
} from '@phosphor-icons/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { AppTopBar } from '#/app/components/AppTopBar'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  const { tasks } = useBoardTasks()
  const { openNewTask } = useBoardDialogs()
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <div className="flex h-full flex-col">
      <AppTopBar
        addLabel="Add task"
        backlogCount={tasks.backlog?.length ?? 0}
        onAddTask={() => openNewTask('todo')}
        searchPlaceholder="Search tasks…"
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="bg-paper min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-16 sm:py-24">
          {/* Hero */}
          <header className="flex flex-col gap-6">
            <h1 className="font-heading text-4xl font-medium leading-tight tracking-tight text-foreground sm:text-5xl">
              An asynchronous workbench <br className="hidden sm:inline" />
              for local codebases.
            </h1>
            <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Agent Todo is not a generic task manager. It is a local-first orchestration board
              designed to delegate coding tasks to AI agents asynchronously. You assign the work,
              they execute it directly on your filesystem, and you review the results.
            </p>
          </header>

          {/* Pillars / Bento */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={<HardDrivesIcon size={18} weight="duotone" />}
              title="Local First"
              description="Runs entirely on your machine. Agents read and write directly to your local project directories. No cloud syncing required."
            />
            <FeatureCard
              icon={<KanbanIcon size={18} weight="duotone" />}
              title="Async Delegation"
              description="Queue up tasks, assign models, and step away. Agents work in the background and leave a complete transcript of their execution."
            />
            <FeatureCard
              icon={<RobotIcon size={18} weight="duotone" />}
              title="Bring Your Own Agents"
              description="Seamlessly integrates with Claude Code and Codex. Choose the right model, effort level, and context mode for every task."
            />
            <FeatureCard
              icon={<TerminalWindowIcon size={18} weight="duotone" />}
              title="Live Console"
              description="Watch the agent's thought process, tool usage, and shell commands stream in real-time, or review them later."
            />
          </section>

          {/* Links / CTA */}
          <section className="flex flex-col items-start gap-4 border-t border-border pt-8 sm:flex-row sm:items-center">
            <Link
              to="/"
              className="group flex items-center gap-2 border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-primary-hard-lg transition-colors hover:bg-primary/90"
            >
              Open Task Board
              <ArrowRightIcon
                size={14}
                weight="bold"
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/6"
            >
              <GithubLogoIcon size={16} weight="fill" />
              Source Code
            </a>
          </section>
        </main>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-3 border border-border bg-card/40 p-5 transition-colors hover:border-foreground/30 hover:bg-card sm:p-6">
      <div className="flex size-8 items-center justify-center border border-border bg-background text-foreground">
        {icon}
      </div>
      <h3 className="font-heading text-base font-medium tracking-tight text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}
