# agent-todo

`agent-todo` is a local-first task board for running coding work through AI agents inside a real project.

It is designed for teams and individual developers who want more than an ad hoc chat window. Tasks live on a board, runs stay attached to their task, project context is explicit, and the full execution transcript remains available for review.

## Why use it

Most AI coding workflows fall apart in predictable ways:

- useful prompts get lost in chat history
- long-running work has no clear owner or status
- model choice and execution mode are not tracked
- analysis and implementation get mixed together
- there is no reliable record of what the agent actually did

`agent-todo` gives that work a structure:

- create tasks instead of one-off prompts
- assign the right agent and mode for each job
- run against a selected local project directory
- move work through backlog, active work, and completion
- review the full transcript after the run

## Features

- Kanban board for active work and a backlog for queued tasks
- Task editor with agent, model, task type, and mode selection
- `ask` mode for read-only analysis and `code` mode for implementation work
- Live run console with streamed progress and execution output
- Support for both `codex` and `claude` agent flows
- Search across tasks
- Local project selection, with fallback to `~/.agent-todo/scratch` when no project is chosen

## Examples of when it is useful

### 1. Queue parallel code work

You need to move several workstreams forward at once:

- refactor a feature module
- investigate a failing test suite
- audit a subsystem and write a recommendation

Instead of juggling separate terminal sessions and prompt threads, create three tasks, assign the right agent and mode to each one, and review the results from one place.

### 2. Separate analysis from implementation

Use `ask` mode to investigate questions such as:

- "Trace how authentication works in this repo"
- "Find why drag-and-drop highlighting is inconsistent"
- "Compare our Claude integration with another implementation"

Then turn the result into a follow-up `code` task once the direction is clear.

### 3. Keep prompt-heavy work under control

If a large feature request would normally turn into an unwieldy conversation, store it as a task, attach the right project context, refine it over time, and run it when it is ready.

### 4. Run agent work against a real local project

When a task depends on file access, project structure, or direct edits, the agent can run in the selected project directory instead of a detached workspace.

## Tech stack

- Monorepo managed with `pnpm`
- Node.js `>=22.5.0`
- Client: TanStack Start, Vite, React 19, TypeScript
- Server: Node ESM HTTP backend with agent orchestration
- Shared package for contracts, config, constants, runtime helpers, and validation

## Getting started

### Prerequisites

- Node.js `>=22.5.0`
- `pnpm`
- A locally available supported agent setup if you want to execute tasks (`codex` and/or `claude`)

### Install dependencies

```bash
pnpm install
```

## Running the project

### Development mode

Start the client and server together:

```bash
pnpm dev
```

This starts:

- client on `http://localhost:3000`
- server on `http://localhost:8787`

If you only want one side:

```bash
pnpm dev:client
pnpm dev:server
```

### Run the built app

Build the project first:

```bash
pnpm build
```

Then start the app:

```bash
pnpm start
```

By default, the root CLI serves the app at `http://localhost:3737` and opens the browser automatically.

You can also control the port and browser behavior:

```bash
pnpm start -- --port 4000 --no-open
```

### Preview the client build

If you only want to preview the built frontend:

```bash
pnpm preview
```

## Basic workflow

1. Open the board.
2. Add a task or move one from backlog into active work.
3. Select the project directory the agent should use.
4. Choose an agent and mode.
5. Run the task.
6. Review the live console and transcript.
7. Update, re-run, or move the task based on the result.

## Project structure

```text
.
├── bin
│   └── agent-todo.mjs         # root CLI entry
├── packages
│   ├── client                 # TanStack Start / Vite / React app
│   ├── server                 # Node HTTP backend + agent orchestration
│   └── shared                 # shared contracts, config, constants, validation
└── tests
    └── e2e                    # cross-package end-to-end tests
```

More specifically:

- `packages/client/src/app`: router wiring, shell, app-level components, styles
- `packages/client/src/features`: task board, task editor, run console, theme, agent config
- `packages/client/src/entities`: frontend entity-facing types and mappers
- `packages/client/src/shared`: reusable UI primitives, shared helpers, API aggregation
- `packages/server/src/domains`: tasks, runs, projects, agents, business logic
- `packages/server/src/infrastructure`: DB, HTTP helpers, filesystem helpers, static serving, agent clients
- `packages/shared/src`: contracts, config, constants, runtime helpers, validation

## Common commands

```bash
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm build
pnpm preview
pnpm start
pnpm test
pnpm typecheck
pnpm biome:check
pnpm check:ci
```

## Testing

Run all package-local test suites with:

```bash
pnpm test
```

## Notes

- Use `code` mode for tasks that may edit files.
- Use `ask` mode for read-only analysis.
- `packages/client/src/routeTree.gen.ts` is generated output and should not be edited manually.
