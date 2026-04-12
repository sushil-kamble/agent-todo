---
description: Review staged and unstaged changes for shippability without editing code.
thinking: high
restore: true
---
I want a review-only ship check for the current worktree.

Scope: $@

Review the current staged changes and any relevant unstaged changes as a code review. Do not edit code, do not apply fixes, do not stage or unstage files, and do not change the worktree in any way.

Use this workflow:

1. Inspect the current git state first.
   - Check both staged and unstaged changes.
   - Separate intended feature work from unrelated or accidental changes.

2. Review the implementation quality.
   - Look for duplicated logic.
   - Check whether logic lives in the correct layer and file.
   - Check whether shared behavior was implemented once or copied into multiple UI/server paths.
   - Check whether any dead code, stale plumbing, or partially-removed behavior remains.

3. Review correctness and edge cases.
   - Look for behavioral regressions.
   - Check move flows, delete flows, counts, routing, keyboard shortcuts, persistence, and refresh behavior if relevant.
   - Check whether client-side behavior and server-side persistence are consistent.
   - Check whether any new state can become inconsistent after reload, navigation, or partial failure.

4. Review testing coverage.
   - Identify whether core tests exist for the new behavior.
   - Prefer targeted validation such as existing Vitest suites, package builds, and type-checking when useful.
   - Do not write tests. Only run read-only validation commands when appropriate.
   - Call out missing coverage for critical flows, edge cases, or regressions.

5. Return a review, not an implementation plan.
   - Findings first, ordered by severity.
   - Include concrete file references and line references where possible.
   - Explicitly say if no blocking issues were found.
   - After findings, include:
     - open questions or assumptions
     - test/validation summary
     - residual risks or coverage gaps

Important constraints:

- Do not edit any file.
- Do not run destructive git commands.
- Do not propose speculative changes unless tied to a concrete finding.
- Prefer actionable, high-signal review comments over broad summaries.
- If the change is clean, say so explicitly, but still mention any meaningful gaps in coverage.
