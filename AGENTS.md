# agentodo

Guidance for AI coding agents (Codex, Claude, others) working in this repo. The deeper architecture and publishing-model notes live in [`CLAUDE.md`](./CLAUDE.md) — read it before non-trivial work.

## Purpose

Local-first kanban board for AI agent tasks. Published as the npm package `agentodo`; users run `npx agentodo` to boot a server + UI on `localhost:3737`.

## Stack

- Monorepo managed with `pnpm`
- Node.js `>=22.5.0`
- Client: TanStack Start, Vite, React 19, TypeScript, Tailwind v4
- Server: Node ESM HTTP backend with agent orchestration
- Shared: contracts, config, runtime helpers, validation

## Workspace

- `packages/client` — UI, routes, feature modules, shared UI primitives
- `packages/server` — HTTP server, domains, repositories, agent clients
- `packages/shared` — cross-package contracts, constants, config, runtime helpers
- `bin/agentodo.mjs` — CLI entry shipped in the npm tarball

The three workspace packages are private (`@agent-todo/*`); only the **root** package publishes as `agentodo`.

## Commands

- `pnpm install`
- `pnpm dev` — client (3000) + server (8787) in parallel
- `pnpm build` — shared + client (Vite + SSR)
- `pnpm start` — boot the built app via `bin/agentodo.mjs` at :3737
- `pnpm test`
- `pnpm typecheck`
- `pnpm lint` / `pnpm format`
- `pnpm check:ci` — typecheck + biome + tests

Single test: `pnpm --filter @agent-todo/<server|client> test -- <path-or--t-pattern>`.

## Project rules

- Use `pnpm` for all workspace tasks; never `npm` or `yarn`.
- Keep shared types and validation in `packages/shared`.
- Keep client work inside the `app` → `routes` → `features` → `entities` → `shared` boundary; no cross-feature imports.
- Keep server business logic in `domains/`; keep transport and integrations in `infrastructure/`.
- Server source uses subpath imports (`#app/`, `#domains/`, `#infra/`, `#testing/`) — prefer them over long relative paths inside `packages/server/src/`.
- Treat `packages/client/src/routeTree.gen.ts` as generated output.
- Format and lint with Biome using the repo defaults (`pnpm format`).

## Don't break the publish model

The published tarball is the root package shipping pre-built artifacts; consumers don't run `pnpm install` inside it. Concretely:

- Server code reaches `packages/shared/` via **relative paths** (`../../../../shared/src/...`), not `@agent-todo/shared/...`. Workspace specifiers fail post-install.
- The server cannot import `.ts` files at runtime — Node refuses to strip types under `node_modules`. Anything the server needs at runtime lives in `packages/shared/src/runtime/*.mjs`.
- Any new npm package the running app imports must be added to the **root** `package.json` `dependencies` (workspace deps are ignored after install).
- New top-level files needed at runtime must be added to the `files` whitelist in `package.json`.

`CLAUDE.md` has the long-form rationale and a "things that have bitten us" list.

## Agent runtime modes

- `code` mode is allowed to edit files and expects a project path.
- `ask` mode is read-only analysis and must not write files or mutate git state.
- If no project is selected, runs fall back to the scratch directory under `~/.agentodo/scratch`.

## Local data

- SQLite database: `~/.agentodo/agentodo.db`
- Scratch workspace: `~/.agentodo/scratch`
- Browser localStorage keys: `agentodo-*`

## Release flow

Automated via `.github/workflows/publish.yml`. Pushing a `v*` tag triggers a build and `npm publish --provenance` (the workflow validates the tag matches `package.json` version). CI on `main` and PRs runs `typecheck`, `biome:check`, `test`, and `build`.

Sequence: update `CHANGELOG.md`, bump `version`, `pnpm build` + `npm pack` to inspect, commit, `git tag vX.Y.Z && git push origin main vX.Y.Z`, then `gh release create vX.Y.Z` after the workflow succeeds. See `CONTRIBUTING.md` for full details.
