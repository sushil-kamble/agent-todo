# agentodo

**A local-first kanban board for the work you hand to AI agents.**

agentodo turns coding prompts into structured tasks on a real board. Assign an agent, pick a model, point it at a local project — then step away while it runs. Every run keeps its transcript, so you can review, follow up, or re-run from the same card.

---

## Quick start

```bash
npx agentodo
```

That's it. The CLI boots the server at <http://localhost:3737> and opens your browser.

```bash
npx agentodo --port 4000 --no-open
```

### Prerequisites

- **Node.js `>=22.5.0`**
- At least one agent CLI installed locally (optional — needed only to run tasks):
  - [`claude`](https://docs.anthropic.com/claude/docs/claude-code) (Claude Code)
  - [`codex`](https://github.com/openai/codex) (OpenAI Codex)

You can open the board and create tasks without an agent installed — you just can't run them.

---

## Why it exists

Most AI coding workflows fall apart the same way:

- Useful prompts get lost inside long chat threads.
- Long-running work has no clear owner or status.
- Model, effort, and mode choices aren't tracked.
- Analysis and implementation get tangled together.
- There's no reliable record of what the agent actually did.

agentodo gives that work a shape:

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
- **Local project picker** with a safe `~/.agentodo/scratch` fallback.
- **Keyboard shortcuts**: `N` new task, `B` backlog, `/` search, `Esc` close.
- **Light / dark themes** with no-flash theme boot.

---

## Your first task

1. Open the board at <http://localhost:3737>.
2. Click **Add task** (or press `N`).
3. Pick a **project directory** — or leave it empty to use the scratch workspace.
4. Choose the **agent**, **model**, **effort**, and **mode** (Ask vs Code).
5. Drag the card to **In Progress** (or hit run from the editor) to kick it off.
6. Watch the **live console** stream the agent's work.
7. Move the card to **Completed** when you're happy, or send a follow-up message on the same transcript.

> **Tip.** Use **Ask mode** first to scope a change ("Trace how auth works in this repo"). Convert the result into a **Code mode** task once the direction is clear.

---

## Local data

agentodo stores everything on your machine:

- SQLite database: `~/.agentodo/agentodo.db`
- Scratch workspace (when no project is selected): `~/.agentodo/scratch`

Nothing is sent to a remote server.

---

## Development

```bash
git clone https://github.com/sushil-kamble/agent-todo.git
cd agent-todo
pnpm install
pnpm dev
```

- Client → <http://localhost:3000>
- Server → <http://localhost:8787>

```bash
pnpm build       # build shared + client for production
pnpm start       # run the built app via the root CLI (port 3737)
pnpm test        # run all package test suites
pnpm typecheck   # typecheck every package
pnpm check:ci    # typecheck + biome + tests
```

---

## Tech stack

- Monorepo managed with **pnpm**
- **Node.js `>=22.5.0`**
- **Client**: TanStack Start, Vite, React 19, TypeScript, Tailwind v4
- **Server**: Node ESM HTTP backend with agent orchestration
- **Shared**: contracts, config, constants, runtime helpers, validation

---

## License

MIT © Sushil Kamble
