# agentodo

Guidance for AI coding agents (Codex, Claude, others) working in this repo. **`CLAUDE.md` is the canonical playbook** — read it before non-trivial work, especially the "Operating model" and "Release playbook" sections. This file is the short-form briefing.

## How the user works with this repo

You are the operator. The user prompts; you commit, push, release, and verify. Do not ask the user to run release or git commands themselves — execute the playbooks in `CLAUDE.md` autonomously and report what changed. The only times to pause for the user are: ambiguous intent, destructive actions outside the standard playbooks, or environment problems that need their credentials.

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

## Committing

- Run `pnpm typecheck && pnpm biome:check && pnpm test` before committing. Fix failures; never `--no-verify`.
- Inspect `git status` before staging. Avoid `git add -A` blind — `.kilocode/`, `.temp/`, scratch tarballs leak in.
- Short imperative subjects (`Fix X`, `Add Y`, `Refresh lockfile after Z`). No Conventional Commits prefix. Body only when *why* isn't obvious.
- Commit at logical checkpoints; push to `origin main` once green. Never leave a dirty tree at the end of a turn.
- If you change root `package.json` deps, run `pnpm install --lockfile-only` and commit `pnpm-lock.yaml` in the same commit — otherwise CI breaks with `ERR_PNPM_OUTDATED_LOCKFILE`.

## Release flow (do this autonomously when asked)

Automated via `.github/workflows/publish.yml`. Pushing a `v*` tag triggers `npm publish --provenance --access public`. The workflow validates that the tag matches `package.json` version.

Bump kind: **patch** for fixes, **minor** for new features, **major** for breaking changes (CLI flags, DB schema, `~/.agentodo/` layout). Below 1.0.0 still respects the spirit of semver.

Run, in order:

1. `git status` clean? `npm view agentodo version` to know the current published version.
2. Update `CHANGELOG.md`: move `[Unreleased]` items into a new `[X.Y.Z] - YYYY-MM-DD` section, add the compare-link footer.
3. Bump `version` in root `package.json` only.
4. `pnpm build && npm pack` — inspect tarball file count and size against the previous release.
5. Smoke-boot the tarball against an empty data dir (see `CLAUDE.md` for the exact recipe). `/api/tasks` must return `{"tasks":[]}` and `/` must return 200.
6. Commit (`Release vX.Y.Z`), push `main`, then `git tag vX.Y.Z && git push origin vX.Y.Z`.
7. `gh run watch --workflow=publish.yml --exit-status`.
8. `npm view agentodo version` confirms the new version is live.
9. `gh release create vX.Y.Z` with notes from the changelog entry.

If the publish workflow fails: read the log, fix on `main`, then **delete the tag** (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`) and re-tag from the fix commit. Do **not** bump to the next version to skirt a failed publish — fix the root cause.

CI (`.github/workflows/ci.yml`) runs `typecheck`, `biome:check`, `test`, `build` on push to `main` and on PRs.

## Tarball discipline

- New root `dependencies` only when required at `npx agentodo` boot — build-only tooling stays in workspace `devDependencies`.
- Don't add heavyweight deps without a `du -sh node_modules` measurement and the user's sign-off.
- New runtime files outside `bin/`, `packages/*/src`, `packages/client/dist` need a `files` whitelist update in `package.json`.

## Secrets and tokens

Never commit, log, or echo a token. The npm publish secret lives in repo Actions secrets as `NPM_TOKEN`. Set or rotate via `gh secret set NPM_TOKEN --repo sushil-kamble/agent-todo` (prompts privately). If the user pastes a token in plain chat, set it as a secret immediately and tell them to rotate it.
