# agent-todo

## Purpose
- AI-powered task board for running agent work inside a project context.
- Supports `codex` and `claude` agents with `code` and `ask` task modes.

## Stack
- Monorepo managed with `pnpm`
- Node.js `>=22.5.0`
- Client: TanStack Start, Vite, React 19, TypeScript
- Server: Node ESM HTTP backend with agent orchestration
- Shared: contracts, config, runtime helpers, validation

## Workspace
- `packages/client`: UI, routes, feature modules, shared UI primitives
- `packages/server`: HTTP server, domains, repositories, agent clients
- `packages/shared`: cross-package contracts, constants, config, runtime helpers
- `bin/agent-todo.mjs`: root CLI entry

## Commands
- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm test`
- `pnpm typecheck`
- `pnpm biome:check`

## Project Rules
- Use `pnpm` for all workspace tasks.
- Keep shared types and validation in `packages/shared`.
- Keep client work inside feature/entity/shared boundaries instead of ad hoc cross-imports.
- Keep server business logic in `domains/`; keep transport and integrations in `infrastructure/`.
- Treat `packages/client/src/routeTree.gen.ts` as generated output.
- Format and lint with Biome using the repo defaults.

## Agent Notes
- `code` mode is allowed to edit files and expects a project path.
- `ask` mode is read-only analysis and must not write files or mutate git state.
- If no project is selected, runs fall back to the scratch directory under `~/.agent-todo/scratch`.
