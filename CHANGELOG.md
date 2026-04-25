# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/sushil-kamble/agent-todo/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/sushil-kamble/agent-todo/releases/tag/v0.1.0
