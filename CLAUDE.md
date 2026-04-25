# CLAUDE.md

Canonical playbook for AI coding agents. Keep compact; `AGENTS.md` is only the
short briefing.

## Repo Shape

`agentodo` is the published npm package users run with `npx agentodo`. It boots a
local-first kanban board on `localhost:3737` from one Node process serving API
and SSR UI.

Workspaces:

- `packages/client` - TanStack Start, Vite, React 19, TypeScript, Tailwind v4.
- `packages/server` - Node ESM HTTP backend and agent orchestration.
- `packages/shared` - contracts, constants, runtime helpers, validation.
- `bin/agentodo.mjs` - published CLI entry.

Only the root package publishes as `agentodo`; workspaces are private.

## Commands

Use `pnpm`, never `npm` or `yarn`, for workspace tasks.

```bash
pnpm dev            # client :3000 + server :8787
pnpm build          # shared + client SSR build
pnpm start          # built app via bin/agentodo.mjs on :3737
pnpm typecheck
pnpm biome:check
pnpm lint
pnpm format         # writes Biome fixes/import ordering
pnpm test
pnpm check:ci       # typecheck + biome:check + test
```

Single tests:

```bash
pnpm --filter @agent-todo/server test -- path/to/file.test.mjs
pnpm --filter @agent-todo/client test -- -t "test name pattern"
```

`pnpm test` uses per-workspace Vitest configs; root config is not the suite driver.

## Publish Model

Read before touching imports, dependencies, startup, or packaging.

- The tarball ships the root package with `packages/{client/dist,server/src,shared/src}`;
  consumers do not run `pnpm install` inside it.
- Server runtime reaches shared by relative path, e.g. `../../../../shared/src/...`.
  Do not import `@agent-todo/shared` from server runtime code.
- Server runtime cannot import `.ts` after install. Server-needed shared values
  belong in `packages/shared/src/runtime/*.mjs`; `.ts` re-exports are only for
  client/build-time consumers.
- Packages needed during `npx agentodo` boot, including SSR runtime imports, must
  be in root `package.json` `dependencies`.
- New runtime top-level files outside `bin/`, `packages/*/src`,
  `packages/client/dist` need root `package.json` `files` updates.
- `prepublishOnly` runs `pnpm run build`; still inspect release pack output for
  layout changes.

## Architecture

Server:

- `bin/agentodo.mjs` is the published entry; it checks client dist, sets `PORT`,
  imports `createApp`/`seedIfEmpty`, then starts HTTP.
- Dev entry is `packages/server/src/index.mjs` + `app/bootstrap.mjs`; startup
  changes may need both dev and published paths.
- `app/`: HTTP, routing, CORS, static/SSR fallback.
- `domains/`: business logic, routes, repositories.
- `infrastructure/`: SQLite, HTTP helpers, static, filesystem, agent clients.
- `testing/`: fake agent harness for `AGENT_TODO_FAKE_AGENT_MODE=1`.

Agent clients:

- `CodexClient`: `codex app-server` over line-delimited JSON-RPC.
- `ClaudeClient`: `@anthropic-ai/claude-agent-sdk` `query()`.
- Event shape: `thread`, `turnStarted`, `agentDelta`, `item`, `turnCompleted`,
  `error`, `exit`; `domains/runs/run-manager.mjs` bridges to SSE.
- New agent: client with same events, registry entry, shared config.

Client:

- Layout/import flow: `app` -> `routes` -> `features` -> `entities` -> `shared`.
  No upward or cross-feature imports.
- `packages/client/src/routeTree.gen.ts` is generated; do not edit.
- Build output: `dist/client/` + `dist/server/`; server prefers SSR
  `dist/server/server.js`, then SPA fallback.

Shared:

- `.ts`: client/build-time types and values.
- `runtime/*.mjs`: server runtime ESM. Mirror server-needed values here.

Local data:

- SQLite: `~/.agentodo/agentodo.db`.
- Scratch workspace: `~/.agentodo/scratch` for tasks without a project.
- Browser storage keys: `agentodo-*`.

## Code Rules

- ESM everywhere; no CJS. Server/shared runtime use `.mjs`; client/shared use
  `.ts`/`.tsx`.
- Biome is the formatting source: single quotes, no semicolons unless needed,
  100-char lines, ES5 trailing commas.
- Strict TypeScript with `verbatimModuleSyntax`; use `import type`.
- Keep comments lean.
- Schema is inline in `infrastructure/db/index.mjs`; no migration framework.
  Prefer additive changes unless adding migrations.
- `ask` agent mode is read-only. `code` mode can edit and expects a project path.

## Operating Model

The user prompts; you operate end to end. Do not ask the user to run git,
release, or verification commands unless credentials or ambiguous intent block you.

Commit logical checkpoints; do not leave your own work dirty. Push `origin main`
after a green commit unless the user asks for a PR flow.

Before committing, run and fix:

```bash
pnpm typecheck
pnpm biome:check
pnpm test
```

Never use `--no-verify`. Inspect `git status` before staging; avoid blind
`git add -A`.

Commit subjects: short imperative, no Conventional Commit prefix, no trailing
period. Body only when why is not obvious.

If any `package.json` dependency/specifier changes, run
`pnpm install --lockfile-only` and commit `pnpm-lock.yaml`.

## Release Playbook

Use when the user says release, ship, publish, or names a version. Pushing a
`v*` tag triggers `.github/workflows/publish.yml`; tag must match root version.

Version choice:

- patch: fixes, docs, internal refactors.
- minor: new user-visible features or additive surface.
- major: breaking CLI flags, DB schema, `~/.agentodo/` layout, or contracts.
- Below `1.0.0`, still avoid breaking changes in patches.

Run in order:

```bash
git status
npm view agentodo version
# Update CHANGELOG.md: move [Unreleased] into [X.Y.Z] - YYYY-MM-DD and add footer.
# Bump only root package.json.
pnpm build
pnpm pack:release
tar -tzf .temp/npm-pack/agentodo-X.Y.Z.tgz | sort
ls -lh .temp/npm-pack/agentodo-X.Y.Z.tgz

rm -rf /tmp/agentodo-pack-test ~/.agentodo
mkdir /tmp/agentodo-pack-test && cd /tmp/agentodo-pack-test
npm init -y >/dev/null
npm install /absolute/path/to/.temp/npm-pack/agentodo-X.Y.Z.tgz
npx agentodo --no-open --port 3739 &
sleep 4
curl -sf http://localhost:3739/api/tasks
curl -sf -o /dev/null -w "%{http_code}\n" http://localhost:3739/
kill %1; cd -

git add CHANGELOG.md package.json
git commit -m "Release vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
gh run watch --workflow=publish.yml --exit-status
npm view agentodo version
gh release create vX.Y.Z --title "vX.Y.Z - <one-line summary>" --notes "<changelog body>"
```

Smoke expects `/api/tasks` -> `{"tasks":[]}` and `/` -> 200.

If publish fails, read `gh run view <run-id> --log-failed`, fix on `main`,
delete the tag locally/remotely, then re-tag from the fix commit:

```bash
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
```

Do not bump versions to dodge failed publish. Manual fallback only if Actions is
broken: confirm `npm whoami` as `sushil_kamble`, then `npm publish --access public`.

## CI, Tarballs, Secrets

- CI: frozen install, `typecheck`, `biome:check`, `test`, `build`.
- Do not disable/skip checks to get green; fix the cause or ask.
- Root dependencies must be needed for `npx agentodo` boot. Build-only tools go
  in workspace `devDependencies`.
- `@anthropic-ai/claude-agent-sdk` is already heavyweight; measure
  `du -sh node_modules` and get sign-off before another large dep.
- `pnpm pack:release` writes tarballs to ignored `.temp/npm-pack/`; inspect that
  output for layout-affecting changes.
- Never commit, log, or echo tokens. Set secrets with `gh secret set <NAME>` and
  tell the user to rotate plaintext tokens.

## Prior Footguns

- `seedIfEmpty()` must keep new installs empty; no maintainer-local paths.
- Workspace imports or `.ts` server imports pass dev but break installed package.
- Missing `files` entries silently omit runtime artifacts.
- Root dependency changes without lockfile updates fail CI/publish.
