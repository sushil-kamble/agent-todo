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

## Operating model — read this before touching the repo

You are operating this repo end-to-end on the user's behalf. The user does not run release commands themselves. You are responsible for committing, pushing, releasing, and verifying. The user prompts; you execute the playbooks below verbatim unless they explicitly override.

### When to commit

Commit at meaningful checkpoints (a logical change is complete, not "after every edit"). Always commit your own changes before declaring a task done — never leave the working tree dirty for the next session. Push to `origin main` once committed unless the user asked for a PR-based flow.

Required pre-commit gates (run them; do not skip):

```bash
pnpm typecheck
pnpm biome:check
pnpm test
```

If any fails, fix it before committing. Don't bypass with `--no-verify`. Don't `git add -A` without checking what's about to be staged — `.kilocode/`, `.temp/`, scratch tarballs, and other dev artifacts have leaked in before. Inspect `git status` first.

### Commit message style

Short imperative subject, no Conventional Commits prefix, no trailing period:

```
Refresh pnpm-lock.yaml after hoisting SSR deps to root
Fix seedIfEmpty inserting a maintainer-local project path
Wire up GitHub Actions for CI and npm publish
```

Body only when *why* isn't obvious from the diff. Skip co-author trailers unless the user specifically asks for them.

### Release playbook (do this autonomously when the user says "release", "ship it", "publish vX.Y.Z", or similar)

Releases are automated by `.github/workflows/publish.yml`: pushing a `v*` tag triggers `npm publish --provenance --access public`. The workflow refuses to publish if the tag and `package.json` version disagree.

Pick the version bump using semver:

- **patch** (`0.1.1 → 0.1.2`): bug fixes, doc tweaks, internal refactors with no behavior change for consumers.
- **minor** (`0.1.x → 0.2.0`): new features, additive API surface, anything users might want to know about.
- **major** (`0.x → 1.0` or `1.x → 2.0`): breaking changes to the CLI flags, the on-disk DB schema, the `~/.agentodo/` layout, or any other user-visible contract.

Below `1.0.0` we still respect the spirit of semver — don't ship breaking changes in a patch.

Steps (run in order, fix failures before continuing):

```bash
# 1. Verify clean tree and current published version
git status
npm view agentodo version

# 2. Update CHANGELOG.md — move [Unreleased] entries into a new
#    [X.Y.Z] - YYYY-MM-DD section, add the compare-link footer,
#    keep the [Unreleased] header in place for next time.

# 3. Bump version in root package.json (no other package.json files).

# 4. Build and inspect the tarball locally — confirm file count and size
#    haven't ballooned vs prior release.
pnpm build
npm pack
tar -tzf agentodo-X.Y.Z.tgz | sort
ls -lh agentodo-X.Y.Z.tgz

# 5. Sanity-boot the packed tarball against an empty data dir
#    (catches publish-model regressions like .ts imports or missing files)
rm -rf /tmp/agentodo-pack-test ~/.agentodo
mkdir /tmp/agentodo-pack-test && cd /tmp/agentodo-pack-test
npm init -y >/dev/null && npm install /absolute/path/to/agentodo-X.Y.Z.tgz
npx agentodo --no-open --port 3739 &
sleep 4
curl -sf http://localhost:3739/api/tasks   # expect {"tasks":[]}
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3739/   # expect 200
kill %1; cd -

# 6. Commit and push the version bump + changelog
git add CHANGELOG.md package.json
git commit -m "Release vX.Y.Z"
git push origin main

# 7. Tag and push the tag — this is what triggers the publish workflow
git tag vX.Y.Z
git push origin vX.Y.Z

# 8. Watch the workflow to completion
gh run watch --workflow=publish.yml --exit-status

# 9. Verify the new version is live on the registry
npm view agentodo version    # should now equal X.Y.Z

# 10. Cut the GitHub release with notes derived from the changelog entry
gh release create vX.Y.Z --title "vX.Y.Z — <one-line summary>" --notes "<changelog body>"
```

If step 8 fails: read the workflow log with `gh run view <run-id> --log-failed`, fix the cause on `main`, delete the tag locally and remotely (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z`), then re-tag and re-push. Never bump to a higher version just to "get past" a failed publish — fix the root cause first.

Manual publish fallback (only if Actions is broken): `npm whoami` to confirm auth as `sushil_kamble`, then `npm publish --access public`. Skip provenance in this case.

### Tarball discipline

The tarball must stay small and dep-light. Run `npm pack` and inspect the listing for any layout-affecting change. Hard rules:

- A new top-level `dependency` must be required by something that runs on `npx agentodo` boot. Build-only tooling goes in `devDependencies` of the workspace that needs it, never the root.
- `@anthropic-ai/claude-agent-sdk` already costs ~210 MB of transitive install — don't add more heavyweights without explicit user sign-off and a measurement (`du -sh node_modules` before/after).
- New runtime files outside `bin/` and the existing `packages/*/src` and `packages/client/dist` paths require a `files` whitelist update.

### CI

`.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile`, then `typecheck`, `biome:check`, `test`, `build` on push to `main` and on PRs. If you add a root `dependency` (or change any `package.json` specifier), you **must** refresh the lockfile in the same commit:

```bash
pnpm install --lockfile-only
git add pnpm-lock.yaml
```

Otherwise CI fails with `ERR_PNPM_OUTDATED_LOCKFILE` and the publish workflow fails the same way. Run `pnpm install --frozen-lockfile` locally as a final check before pushing.

### When CI or the publish workflow fails

- Pull the failure with `gh run view <run-id> --log-failed`.
- Fix on `main` with a follow-up commit.
- Don't disable, skip, or mark-allowed-to-fail any check to make it green. The check exists because something broke once; ask the user before removing one.

## Things that have bitten us before

- **Hardcoded user-specific values in seeds or defaults.** `seedIfEmpty()` previously inserted a task whose project path was the maintainer's local directory. New users get an empty board — keep it that way.
- **Workspace-specific imports in server source.** Reverts the publish model. Use relative paths or the `#domains/`, `#infra/`, `#app/`, `#testing/` subpath imports.
- **`.ts` imports from server source.** Works in `pnpm dev` (Node strips types), fails after `npm install` (Node refuses to strip types under `node_modules`). Mirror to `.mjs` instead.
- **Forgetting to update `files` whitelist when adding new runtime artifacts.** They silently disappear from the tarball. Always `npm pack` and inspect the listing for non-trivial layout changes.
- **Lockfile drift after editing root `package.json`.** Causes `ERR_PNPM_OUTDATED_LOCKFILE` in CI and the publish workflow. Always commit `pnpm-lock.yaml` alongside any `package.json` change.
- **Sensitive values in chat or commits.** Never echo, log, or commit npm tokens, GitHub tokens, or other credentials. Set secrets via `gh secret set <NAME>` (which prompts privately) and tell the user to rotate any token they've pasted in plaintext.
