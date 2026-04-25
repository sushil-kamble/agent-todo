# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo ships

`agentodo` is a published npm package (`npx agentodo`) that boots a local-first kanban board on `localhost:3737`. Users install one package and the CLI serves both the API and the SSR'd UI from a single Node process.

This shape constrains the architecture in ways that aren't obvious from reading any one file — see "Publishing model" below before refactoring imports, dependencies, or the server entry.

## Commands

```bash
pnpm dev            # client (3000) + server (8787) in parallel
pnpm dev:client
pnpm dev:server

pnpm build          # builds @agent-todo/shared then @agent-todo/client (Vite + TanStack Start SSR)
pnpm start          # boots the built app via bin/agentodo.mjs at :3737

pnpm typecheck      # tsc across all workspaces
pnpm lint           # biome lint .
pnpm format         # biome check . --write (formats + organizes imports)
pnpm biome:check    # biome check . (no writes)
pnpm test           # vitest in every workspace that defines `test`
pnpm check:ci       # typecheck + biome:check + test
```

Run a single test file:

```bash
pnpm --filter @agent-todo/server test -- path/to/file.test.mjs
pnpm --filter @agent-todo/client test -- path/to/file.test.mjs
```

Run a single test by name:

```bash
pnpm --filter @agent-todo/server test -- -t "test name pattern"
```

`pnpm test` is configured per workspace (no root vitest config drives the suite). The root `vitest.config.mjs` exists but the actual `test` scripts in `packages/server` and `packages/client` use their own config files.

## Architecture

### Three workspaces, one published package

```
packages/client    # @agent-todo/client — TanStack Start + Vite + React 19 + Tailwind v4
packages/server    # @agent-todo/server — Node ESM HTTP backend (no framework)
packages/shared    # @agent-todo/shared — contracts, constants, runtime helpers, validation
```

Only the **root** `package.json` is published as `agentodo`. The three workspace packages are `private: true` and exist solely for dev ergonomics. Workspace package names (`@agent-todo/*`) are unrelated to the published name (`agentodo`).

### Publishing model — read before changing imports or deps

The published tarball is the root package with `packages/{client/dist,server/src,shared/src}` shipped as plain folders. Consumers do not run `pnpm install` inside the tarball, so:

- **Workspace deps don't survive publish.** The server cannot `import '@agent-todo/shared/...'` — that resolves through pnpm's workspace symlink in dev but fails post-install. Server code uses **relative paths** (`../../../../shared/src/...`) to reach shared. Don't reintroduce workspace specifiers in server source.
- **`.ts` files in `node_modules` cannot be imported by the server.** Node refuses to strip TypeScript types under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). Anything the server needs at runtime must exist as `.mjs` in `packages/shared/src/runtime/`. Mirror values rather than importing the `.ts` source. The client doesn't have this constraint — Vite bundles the `.ts`.
- **Root `dependencies` are the consumer's install set.** Any npm package the running app needs (server runtime + SSR runtime) must be in the root `package.json` `dependencies`. Workspace `dependencies` are ignored after install. The hoisted SSR runtime list (`@tanstack/react-router`, `react`, `react-dom`, `@base-ui/react`, dnd-kit, zustand, etc.) is required by the SSR bundle at runtime.
- **`files` whitelist is authoritative.** Tests, biome config, vitest configs, dev tsconfigs, and SSR-only build artifacts ship only if listed. Adding a new top-level file that the runtime needs requires updating `files` in `package.json`.
- **`prepublishOnly`** runs `pnpm run build` so a clean tarball always reflects current source.

### Server boot flow

`bin/agentodo.mjs` is the published entry. It:

1. Verifies `packages/client/dist/client/` exists (refuses to boot otherwise).
2. Sets `process.env.PORT`, then dynamically imports the server's `createApp` and `seedIfEmpty`.
3. Calls `seedIfEmpty()` (currently a no-op — new users get an empty board) and starts the HTTP server.

`packages/server/src/index.mjs` + `app/bootstrap.mjs` is the **dev** entry (used by `pnpm dev:server`). The bin script bypasses `bootstrap.mjs` to keep the dependency surface minimal in the published binary, so changes to startup behavior may need to land in **both** places.

### Server layout

- `app/` — composition: `http-server.mjs` (CORS, routing, SSR fallback), `router.mjs` (handler array), `bootstrap.mjs` (dev entry).
- `domains/` — business logic, organized by aggregate: `tasks`, `runs`, `projects`, `agents`, `editor`. Each domain owns its `*.routes.mjs` (transport) and `*.repository.mjs` (persistence). Add a new feature here.
- `infrastructure/` — transport-agnostic plumbing: `db/` (SQLite via `node:sqlite`), `http/` (request helpers), `static/` (production static + SSR), `filesystem/`, `agent-clients/` (Codex JSON-RPC, Claude SDK).
- `testing/` — fake agent harness used when `AGENT_TODO_FAKE_AGENT_MODE=1` (E2E mode).

The server uses **subpath imports** defined in `packages/server/package.json`:

```
#app/*       → ./src/app/*
#domains/*   → ./src/domains/*
#infra/*     → ./src/infrastructure/*
#testing/*   → ./src/testing/*
```

Use these instead of long relative paths within `packages/server/src/`. They survive publish because the lookup is anchored at the server's `package.json`, which ships with the tarball.

### Agent clients

`infrastructure/agent-clients/{codex,claude}.mjs` are EventEmitter wrappers around external agent processes:

- `CodexClient` spawns `codex app-server` and speaks line-delimited JSON-RPC over stdio.
- `ClaudeClient` wraps `@anthropic-ai/claude-agent-sdk`'s `query()` async iterator.

Both emit a normalized event vocabulary (`thread`, `turnStarted`, `agentDelta`, `item`, `turnCompleted`, `error`, `exit`). `domains/runs/run-manager.mjs` owns the in-memory `runs` Map and bridges these events into SSE streams. Adding a third agent means: new client class with the same event shape → register it in `domains/agents/agent-registry.mjs` → add a config entry in `packages/shared/src/config/`.

### Client layout (Feature-Sliced-ish)

```
packages/client/src/
  app/        # router wiring, shell, app-level components, global styles
  routes/     # TanStack Router file-based routes (route definitions only)
  features/   # task-board, task-editor, run-console, agent-config, project-picker, theme, editor-launcher
  entities/   # frontend types and mappers per domain entity
  shared/     # reusable UI primitives, helpers, API aggregator
  router.tsx  # router instantiation
  routeTree.gen.ts  # generated by @tanstack/router-plugin — never edit by hand
```

Imports flow downward: `app` → `routes` → `features` → `entities` → `shared`. Don't import upward or sideways across feature folders. The `routeTree.gen.ts` regenerates on `vite dev`/`vite build`; if it's out of sync, run a build.

The client is built with TanStack Start (SSR-by-default). Both a client bundle (`dist/client/`) and an SSR bundle (`dist/server/`) are produced. The HTTP server prefers SSR when `dist/server/server.js` exists, falling back to serving `dist/client/index.html` as a SPA if SSR fails or is missing — see `static-server.mjs`.

### Shared package — runtime vs types

`packages/shared/src/` mixes `.ts` (types + values consumed only by the client/build-time tooling) and `.mjs` (runtime values consumed by the server). The split is **intentional**:

- `contracts/`, `validation/`, most of `constants/` and `config/` → `.ts`. Vite bundles them into the client.
- `runtime/*.mjs` → plain ESM imported by the server at runtime. Mirrors any `.ts` value the server also needs (see `runtime/board-columns.mjs` mirroring `constants/board-columns.ts`).

When you add a value the server needs, put it in `runtime/*.mjs` and re-export from the `.ts` if the client also needs it. **Don't make the server import `.ts`** — it works in dev (Node 22+ type stripping) but breaks once installed via npm.

### Local data

- SQLite database: `~/.agentodo/agentodo.db` (WAL enabled, see `infrastructure/db/index.mjs`).
- Scratch workspace: `~/.agentodo/scratch` — used as `cwd` when a task has no project selected.
- Browser localStorage keys: prefixed `agentodo-` (theme, board cache, task config defaults).

Schema lives inline in `infrastructure/db/index.mjs`. There is no migration framework — the schema uses `CREATE TABLE IF NOT EXISTS` and the codebase favors additive changes. If you need a destructive schema change, you'll need to introduce migrations.

## Conventions

- **Module system**: ESM everywhere (`"type": "module"`). Server/shared runtime are `.mjs`. Client/shared are `.ts`/`.tsx`. No CJS.
- **Style**: Biome enforces single quotes, no semicolons (auto-added only when ambiguous), 100-char lines, ES5 trailing commas, single-arg arrows without parens. `pnpm format` is the source of truth.
- **TypeScript**: strict, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (so use `import type` for type-only imports).
- **Generated files**: `packages/client/src/routeTree.gen.ts` is generated. Don't edit it; don't lint-fix it (Biome already excludes it).
- **Comments**: lean. The codebase uses short header comments per file describing purpose. Don't add comments that just describe what the next line does.

## Release flow

Releases are automated by `.github/workflows/publish.yml`. Pushing a `v*` git tag triggers a build and `npm publish --provenance --access public` against the registry. The workflow refuses to publish if the tag doesn't match the `version` in `package.json`, so version bumps and tags must agree.

Standard release sequence:

1. Move `[Unreleased]` items in `CHANGELOG.md` into a new version section.
2. Bump `version` in root `package.json` to match.
3. `pnpm build` locally and `npm pack` to inspect the tarball — confirm only expected files ship and the size hasn't ballooned.
4. Commit, then `git tag vX.Y.Z && git push origin main vX.Y.Z`.
5. The publish workflow runs on the tag push. Watch it via `gh run list --workflow=publish.yml`.
6. After the workflow succeeds, `gh release create vX.Y.Z` with notes derived from the changelog entry.

Manual fallback if the workflow is unavailable: `npm publish` from a local checkout (auth as `sushil_kamble`) — same end result, no provenance attestation.

CI (`.github/workflows/ci.yml`) runs `typecheck`, `biome:check`, `test`, and `build` on every push to `main` and on PRs.

Tarball discipline: it must stay small and dep-light. Adding a top-level `dependency` adds it to every consumer's `node_modules` — only do it for things the running app needs at runtime. The `@anthropic-ai/claude-agent-sdk` is the dominant install-size cost (~210 MB of transitive deps); avoid adding similar heavyweights without checking install impact.

## Things that have bitten us before

- **Hardcoded user-specific values in seeds or defaults.** `seedIfEmpty()` previously inserted a task whose project path was the maintainer's local directory. Don't reintroduce. New users get an empty board.
- **Workspace-specific imports in server source.** Reverts the publish model. Use relative paths or the `#domains/`, `#infra/`, `#app/`, `#testing/` subpath imports.
- **`.ts` imports from server source.** Works in `pnpm dev` (Node strips types), fails after `npm install` (Node refuses to strip types under `node_modules`). Mirror to `.mjs` instead.
- **Forgetting to update `files` whitelist when adding new runtime artifacts.** They silently disappear from the tarball. Always `npm pack` and inspect the listing for non-trivial layout changes.
