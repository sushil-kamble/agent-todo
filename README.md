# agent-todo

**A local-first kanban board for the work you hand to AI agents.**

Agent Todo turns coding prompts into structured tasks on a real board. Assign an agent, pick a model, point it at a local project — then step away while it runs. Every run keeps its transcript, so you can review, follow up, or re-run from the same card.

---

## Why it exists

Most AI coding workflows fall apart the same way:

- Useful prompts get lost inside long chat threads.
- Long-running work has no clear owner or status.
- Model, effort, and mode choices aren't tracked.
- Analysis and implementation get tangled together.
- There's no reliable record of what the agent actually did.

Agent Todo gives that work a shape:

- Create **tasks** instead of one-off prompts.
- Assign the right **agent**, **model**, and **mode** per task.
- Run against a **selected local project directory**.
- Move cards through **Backlog → Todo → In Progress → Completed**.
- Open the **live console** during the run, review the full transcript after.

---

## Features at a glance

- **Kanban board** with a backlog panel for queued ideas.
- **Two agents out of the box**: Claude Code and Codex.
- **Ask mode** for read-only analysis · **Code mode** for implementation.
- **Per-task controls**: model, effort tier (Low → Max), Fast mode, task type.
- **Live run console** with streamed thoughts, tool calls, and shell output.
- **Task-scoped transcripts** — every run is attached to its card.
- **Local project picker** with a safe `~/.agent-todo/scratch` fallback.
- **Keyboard shortcuts**: `N` new task, `B` backlog, `/` search, `Esc` close.
- **Light / dark themes** with no-flash theme boot.

---

## Quick start

### 1. Prerequisites

- **Node.js `>=22.5.0`**
- **pnpm** — install with `npm install -g pnpm` if you don't have it
- At least one agent CLI installed locally, if you want to execute tasks:
  - [`claude`](https://docs.anthropic.com/claude/docs/claude-code) (Claude Code)
  - [`codex`](https://github.com/openai/codex) (OpenAI Codex)

You can open the board and create tasks without an agent installed — you just can't run them.

### 2. Install

```bash
git clone https://github.com/sushil-kamble/agent-todo.git
cd agent-todo
pnpm install
```

### 3. Run in development

```bash
pnpm dev
```

This starts both halves of the app:

- Client → <http://localhost:3000>
- Server → <http://localhost:8787>

Need only one side?

```bash
pnpm dev:client
pnpm dev:server
```

### 4. Or run the built app

```bash
pnpm build
pnpm start
```

The root CLI serves the app at <http://localhost:3737> and opens your browser.

Customize the port or skip the browser launch:

```bash
pnpm start -- --port 4000 --no-open
```

To preview just the built client:

```bash
pnpm preview
```

---

## Your first task

1. Open the board at <http://localhost:3000> (dev) or <http://localhost:3737> (built).
2. Click **Add task** (or press `N`).
3. Pick a **project directory** — or leave it empty to use the scratch workspace.
4. Choose the **agent**, **model**, **effort**, and **mode** (Ask vs Code).
5. Drag the card to **In Progress** (or hit run from the editor) to kick it off.
6. Watch the **live console** stream the agent's work.
7. Move the card to **Completed** when you're happy, or send a follow-up message on the same transcript.

> **Tip.** Use **Ask mode** first to scope a change ("Trace how auth works in this repo"). Convert the result into a **Code mode** task once the direction is clear.

---

## When it earns its keep

- **Parallel workstreams.** Queue three tasks (refactor a module, investigate a failing test, audit a subsystem) and review them from one place instead of juggling terminal tabs.
- **Separating analysis from implementation.** Ask mode answers the question; a follow-up Code mode task ships the change.
- **Large prompts that outgrow a chat.** Park the request as a task, refine it over time, and run it when it's actually ready.
- **Work that needs real files.** The agent runs inside your project directory — reading real imports, editing real files — not a detached sandbox.

---

## Tech stack

- Monorepo managed with **pnpm**
- **Node.js `>=22.5.0`**
- **Client**: TanStack Start, Vite, React 19, TypeScript, Tailwind v4
- **Server**: Node ESM HTTP backend with agent orchestration
- **Shared**: contracts, config, constants, runtime helpers, validation

---

## Project layout

```text
.
├── bin
│   └── agent-todo.mjs         # root CLI entry (used by `pnpm start`)
├── packages
│   ├── client                 # TanStack Start / Vite / React app
│   ├── server                 # Node HTTP backend + agent orchestration
│   └── shared                 # shared contracts, config, constants, validation
└── tests
    └── e2e                    # cross-package end-to-end tests
```

Inside each package:

- `packages/client/src/app` — router wiring, shell, app-level components, styles
- `packages/client/src/features` — task board, task editor, run console, theme, agent config
- `packages/client/src/entities` — frontend entity types and mappers
- `packages/client/src/shared` — reusable UI primitives, helpers, API aggregation
- `packages/server/src/domains` — tasks, runs, projects, agents, business logic
- `packages/server/src/infrastructure` — DB, HTTP, filesystem, static serving, agent clients
- `packages/shared/src` — contracts, config, constants, runtime helpers, validation

---

## Common commands

```bash
pnpm dev            # run client + server in parallel
pnpm dev:client     # client only
pnpm dev:server     # server only
pnpm build          # build shared + client for production
pnpm preview        # preview the built client
pnpm start          # serve the built app via the root CLI

pnpm test           # run all package test suites
pnpm typecheck      # typecheck every package
pnpm biome:check    # lint + format check
pnpm format         # apply Biome autofixes
pnpm check:ci       # typecheck + biome + tests (what CI runs)
```

---

## Notes

- Use `code` mode for tasks that may **edit files**.
- Use `ask` mode for **read-only** analysis — it will not write files or mutate git state.
- If no project is selected, runs fall back to `~/.agent-todo/scratch`.
- `packages/client/src/routeTree.gen.ts` is generated output — don't edit it manually.
