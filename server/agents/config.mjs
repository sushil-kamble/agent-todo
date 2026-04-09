/**
 * Agent run configuration constants.
 *
 * Swap these to change model / thinking depth without touching any other file.
 *
 * effort: 'low' | 'medium' | 'high' | 'max'
 *   Controls reasoning depth for both agents.
 *   'medium' gives balanced reasoning at lower cost than 'high'/'max'.
 */

// ── Claude (claude-agent-sdk) ──────────────────────────────────────────────
// model: any Claude model identifier supported by Claude Code.
// effort: adaptive thinking depth (replaces deprecated maxThinkingTokens).
export const CLAUDE_MODEL = 'claude-sonnet-4-6'
export const CLAUDE_EFFORT = 'medium'

// ── Codex (codex app-server JSON-RPC) ─────────────────────────────────────
// model: passed to both thread/start and turn/start.
// effort: passed to turn/start; controls per-turn reasoning depth.
export const CODEX_MODEL = 'gpt-5.4'
export const CODEX_EFFORT = 'medium'
