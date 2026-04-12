# agent-todo

AI-powered task board with built-in agent support, organized as a PNPM workspace.

## Workspace layout

```text
.
├── packages
│   ├── client   # TanStack Start / Vite / React app
│   ├── server   # Node HTTP backend + agent orchestration
│   └── shared   # shared contracts, config, constants, validation helpers
├── tests/e2e    # cross-package end-to-end tests
└── bin          # thin root CLI wrapper
```

## Getting started

```bash
pnpm install
pnpm dev
```

This starts:

- `@agent-todo/client` on port `3000`
- `@agent-todo/server` on port `8787`

## Useful commands

```bash
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm build
pnpm test
pnpm typecheck
pnpm biome:check
```

## Package ownership

- `packages/client/src/app`
  - shell, router wiring, app-level components, styles
- `packages/client/src/features`
  - frontend feature ownership such as task board, task editor, run console, theme, and agent config
- `packages/client/src/entities`
  - frontend entity-facing types and mappers
- `packages/client/src/shared`
  - reusable UI primitives, shared client helpers, and API aggregation
- `packages/server/src/domains`
  - domain-driven backend modules for tasks, runs, projects, and agents
- `packages/server/src/infrastructure`
  - database, HTTP helpers, filesystem helpers, static serving, and agent client integrations
- `packages/shared/src`
  - shared contracts, config, constants, runtime helpers, and validation

## Testing

The repo now runs package-local test suites:

- `packages/client/tests`
- `packages/server/tests`
- `tests/e2e`

Run everything with:

```bash
pnpm test
```
