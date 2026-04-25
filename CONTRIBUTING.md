# Contributing to agentodo

Thanks for thinking about contributing. This repo is a small monorepo, so most
contributions are quick to set up.

## Development setup

```bash
git clone https://github.com/sushil-kamble/agent-todo.git
cd agent-todo
pnpm install
pnpm dev
```

- Client → <http://localhost:3000>
- Server → <http://localhost:8787>

Requirements:

- Node.js `>=22.5.0`
- pnpm (see `packageManager` if you have Corepack enabled)

## Workflow

1. Open or claim an issue describing the change.
2. Branch off `main`: `git checkout -b feat/<short-name>`.
3. Keep changes scoped — small PRs land faster.
4. Run the local checks before pushing:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm format
   ```
   Or run them all in CI mode: `pnpm check:ci`.
5. Open a PR against `main`. Reference the issue it closes.

## Commit messages

We follow short, imperative subjects (`Add X`, `Fix Y`, `Refactor Z`). Body
text is optional — use it to explain *why* if it isn't obvious from the diff.

## Code style

- Biome handles linting and formatting — run `pnpm format` before committing.
- TypeScript strict mode is on for `client` and `shared`. The server is `.mjs`
  with JSDoc-style typing where helpful.
- Don't introduce new top-level dependencies in the root `package.json`
  unless they are required at runtime by `npx agentodo`. Workspace packages
  carry their own dev/build deps.

## Reporting bugs / requesting features

Open an issue at <https://github.com/sushil-kamble/agent-todo/issues> with:

- What you expected vs what happened.
- The version of agentodo (`npx agentodo --version` or check `package.json`).
- Your Node.js version.
- Minimal repro steps.

## Releases

Releases are cut from `main` by the maintainer:

1. Update `CHANGELOG.md` (move `[Unreleased]` items into the new version).
2. Bump `version` in the root `package.json`.
3. `pnpm build && npm pack` and inspect the tarball.
4. `npm publish` and tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. Create a GitHub release pointing at the tag.

See `CHANGELOG.md` for the version history.
