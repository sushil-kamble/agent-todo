---
description: Build a new feature across the stack while strictly following our architecture.
---
I want to build a new feature: $1

Please implement this while strictly adhering to our project's architectural benchmarks:

1. **Shared Contracts (`packages/shared/src`)**:
   - Start here. Define any new TypeScript interfaces, run summaries, or Zod schemas. 
   - Ensure nothing imports from client or server.

2. **Backend (`packages/server/src/domains`)**:
   - Use strict `.mjs` (ESM). No TypeScript compilation happens here.
   - Place logic in the appropriate domain folder (e.g., `tasks`, `projects`, `runs`, `agents`).
   - Wire up the `.repository.mjs` and `.routes.mjs` files.

3. **Frontend (`packages/client/src`)**:
   - UI features go in `features/` (e.g., components, local stores).
   - Domain types/mappers go in `entities/`.
   - Reusable primitives go in `shared/`.
   - Use Tailwind CSS and our existing shadcn/ui / Radix components.

4. **Quality & Testing**:
   - Since E2E tests are deferred for rapid iteration, rely on strict type-checking (`pnpm typecheck`).
   - Run `pnpm lint:fix` (Biome) on the files you touch to maintain formatting.
   - If adding complex logic, write a localized Vitest suite in the respective package's `tests/` folder.

Think step-by-step. Outline the files you plan to touch first, and once we agree, execute the exact edits.
