# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-05-01

### Changed
- Added Max thinking effort support for Claude Sonnet 4.6 while keeping the
  existing default effort unchanged.

## [0.1.2] - 2026-05-01

### Changed
- Reworked the board loading state into a branded splash screen with a smoother
  transition into the loaded board.
- Made task cards easier to interact with by separating the drag handle, card
  body, and backlog/todo move actions.
- Cached subscription and project lookups on the client to reduce duplicate
  requests during normal board use.

### Fixed
- Prevented duplicate project imports for equivalent paths and deduped existing
  duplicate projects when listing them.
- Preserved an edited task's project and task type while the async project list
  is still loading.
- Refreshed task data after edit and move mutations so board state stays in sync
  with the server.
- Kept cached board data as a fallback only when a fresh task fetch fails,
  avoiding first-render hydration mismatches.

## [0.1.1] - 2026-04-26

### Fixed
- New users now start with an empty board. Previously, `seedIfEmpty()` inserted
  a hardcoded starter task whose `project` path pointed at the maintainer's
  local directory (`/Users/sushil/...`) — broken on every other machine.

## [0.1.0] - 2026-04-26

First public release on npm as `agentodo`.

### Added
- `npx agentodo` CLI — boots a local-first kanban board for AI agent tasks.
- Two agents out of the box: Claude Code and Codex.
- Ask vs Code mode, per-task model and effort tier, Fast mode toggle.
- Live run console with streamed thoughts, tool calls, and shell output.
- Local SQLite persistence at `~/.agentodo/agentodo.db`; scratch workspace
  at `~/.agentodo/scratch`.
- Light / dark themes with no-flash boot.
- Keyboard shortcuts: `N`, `B`, `/`, `Esc`.

### Notes
- Renamed from internal `agent-todo` to public `agentodo`.
- Storage paths and localStorage keys migrated from `agent-todo*` to
  `agentodo*` — pre-rename data is not auto-migrated.

[Unreleased]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sushil-kamble/agent-todo/releases/tag/v0.1.0
