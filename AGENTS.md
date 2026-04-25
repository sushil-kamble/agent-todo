# agentodo

Short briefing. `CLAUDE.md` is canonical for non-trivial work, commits, releases,
and publish-model details.

## Role

You are the operator: edit, verify, commit, push, release, and report. Pause only
for ambiguous intent, destructive work outside playbooks, or credential blockers.

## Product

`agentodo` is a local-first AI-task kanban. `npx agentodo` boots server + UI on
`localhost:3737`.

Stack: pnpm monorepo, Node `>=22.5.0`, TanStack Start/Vite/React 19/Tailwind v4
client, Node ESM server, shared contracts/config/runtime helpers.

Workspace: `packages/client`, `packages/server`, `packages/shared`,
`bin/agentodo.mjs`. Only the root package publishes as `agentodo`.

## Commands

- `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm start`.
- `pnpm typecheck`, `pnpm biome:check`, `pnpm test`, `pnpm check:ci`.
- Single test: `pnpm --filter @agent-todo/<server|client> test -- <path-or--t-pattern>`

Use `pnpm` for workspace tasks; reserve `npm` for registry/pack/release commands
documented in `CLAUDE.md`.

## Hard Rules

- Shared types/validation live in `packages/shared`.
- Client imports flow `app` -> `routes` -> `features` -> `entities` -> `shared`.
- Server business logic goes in `domains/`; transport/integrations in `infrastructure/`.
- Prefer server subpath imports `#app/`, `#domains/`, `#infra/`, `#testing/`.
- Do not edit generated `packages/client/src/routeTree.gen.ts`.
- Format with repo Biome defaults via `pnpm format`.

## Publish Model

The tarball is the root package with pre-built artifacts; consumers do not run
`pnpm install` inside it.

- Server runtime reaches shared by relative paths, not `@agent-todo/shared`.
- Server runtime cannot import `.ts`; use `packages/shared/src/runtime/*.mjs`.
- Runtime npm deps must be in root `package.json` `dependencies`.
- New runtime top-level files need the root `package.json` `files` whitelist.

## Runtime Modes And Data

- `code` mode edits; `ask` mode is read-only.
- No project falls back to `~/.agentodo/scratch`.
- SQLite: `~/.agentodo/agentodo.db`; browser storage: `agentodo-*`.

## Git And Release

- Before committing: `pnpm typecheck && pnpm biome:check && pnpm test`.
- Inspect `git status`; avoid blind `git add -A`.
- Short imperative commit subjects; no Conventional Commit prefix.
- Commit logical checkpoints and push `origin main` once green.
- Root `package.json` deps require `pnpm install --lockfile-only` and lockfile commit.
- Releases are tag-driven via `.github/workflows/publish.yml`; use `CLAUDE.md`.
- Never commit, log, or echo tokens. Set secrets with private prompts.
