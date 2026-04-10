/**
 * Subscription detection routes.
 *
 * GET /api/subscriptions — detect installed agents and subscription tiers
 *
 * Checks local credential files to determine which agents are available:
 * - Claude Code: ~/.claude/.credentials.json → subscriptionType field
 * - Codex CLI:   ~/.codex/auth.json or ~/.config/codex/auth.json
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { json } from '../lib/http.mjs'

const home = os.homedir()

/** @returns {{ installed: boolean, plan: string | null }} */
function detectClaude() {
  const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude')
  const credPath = path.join(configDir, '.credentials.json')

  try {
    const raw = fs.readFileSync(credPath, 'utf8')
    const creds = JSON.parse(raw)
    const oauth = creds.claudeAiOauth
    if (!oauth?.accessToken) return { installed: true, plan: null }

    let plan = oauth.subscriptionType || null // "pro" | "max" | null
    if (plan) {
      const rlt = String(oauth.rateLimitTier || '')
      const m = rlt.match(/(\d+)x/)
      if (m && m[1] !== '1') plan = `${plan}_${m[1]}x` // e.g. "max_5x"
    }
    return { installed: true, plan }
  } catch {
    // Check if claude binary exists as fallback
    const claudeBin = ['/usr/local/bin/claude', path.join(home, '.npm-global/bin/claude')].some(
      p => {
        try {
          fs.accessSync(p, fs.constants.X_OK)
          return true
        } catch {
          return false
        }
      }
    )
    return { installed: claudeBin, plan: null }
  }
}

/** @returns {{ installed: boolean, plan: string | null }} */
function detectCodex() {
  const candidates = [
    process.env.CODEX_HOME && path.join(process.env.CODEX_HOME, 'auth.json'),
    path.join(home, '.config', 'codex', 'auth.json'),
    path.join(home, '.codex', 'auth.json'),
  ].filter(Boolean)

  for (const credPath of candidates) {
    try {
      const raw = fs.readFileSync(credPath, 'utf8')
      const creds = JSON.parse(raw)
      if (creds.tokens?.access_token) {
        // Plan type is only available via API call, but having valid
        // credentials means the user has at least a Plus subscription
        return { installed: true, plan: 'plus' }
      }
      return { installed: true, plan: null }
    } catch {
      // try next candidate
    }
  }

  return { installed: false, plan: null }
}

// Cache for 60 seconds to avoid repeated fs reads
let cache = null
let cacheTs = 0
const CACHE_TTL = 60_000

function getSubscriptions() {
  const now = Date.now()
  if (cache && now - cacheTs < CACHE_TTL) return cache
  cache = { claude: detectClaude(), codex: detectCodex() }
  cacheTs = now
  return cache
}

export async function handleSubscriptionRoutes(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/subscriptions') {
    return json(res, 200, getSubscriptions())
  }
  return false
}
