/**
 * Subscription detection routes.
 *
 * GET /api/subscriptions — detect installed agents and subscription tiers.
 *
 * Claude detection supports both the legacy credentials file and the current
 * macOS Keychain-backed login flow used by Claude Code.
 */
import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { json } from '../lib/http.mjs'

const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const KEYCHAIN_SERVICE_PREFIX = 'Claude Code'
const home = os.homedir()

/**
 * @typedef {{
 *   accessToken?: string
 *   refreshToken?: string
 *   expiresAt?: number
 *   subscriptionType?: string | null
 *   rateLimitTier?: string | null
 * }} ClaudeOauth
 */

/**
 * @typedef {{
 *   fiveHourUtilization: number | null
 *   fiveHourResetsAt: string | null
 *   sevenDayUtilization: number | null
 *   sevenDayResetsAt: string | null
 * }} ClaudeUsageSnapshot
 */

/**
 * @typedef {{
 *   installed: boolean
 *   plan: string | null
 *   available: boolean
 *   reason: string | null
 *   usage: ClaudeUsageSnapshot | null
 * }} AgentSubscription
 */

function readEnv(env, name) {
  const value = env[name]
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function readEnvFlag(env, name) {
  const value = readEnv(env, name)
  if (!value) return false
  const lower = value.toLowerCase()
  return lower !== '0' && lower !== 'false' && lower !== 'no' && lower !== 'off'
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function tryParseCredentialJson(text) {
  if (!text) return null

  const parsed = tryParseJson(text)
  if (parsed) return parsed

  let hex = String(text).trim()
  if (hex.startsWith('0x') || hex.startsWith('0X')) hex = hex.slice(2)
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) return null

  try {
    const decoded = Buffer.from(hex, 'hex').toString('utf8')
    return tryParseJson(decoded)
  } catch {
    return null
  }
}

function hasExecutable(candidatePath, accessSync = fs.accessSync) {
  try {
    accessSync(candidatePath, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function hasExecutableOnPath(name, env = process.env, accessSync = fs.accessSync) {
  const pathValue = env.PATH || ''
  if (!pathValue) return false

  const extensions =
    process.platform === 'win32'
      ? (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : ['']

  for (const dir of pathValue.split(path.delimiter).filter(Boolean)) {
    for (const ext of extensions) {
      if (hasExecutable(path.join(dir, `${name}${ext}`), accessSync)) return true
    }
  }

  return false
}

function getClaudeOauthConfig(env = process.env) {
  let oauthFileSuffix = ''

  const isAntUser = readEnv(env, 'USER_TYPE') === 'ant'
  if (isAntUser && readEnvFlag(env, 'USE_LOCAL_OAUTH')) oauthFileSuffix = '-local-oauth'
  else if (isAntUser && readEnvFlag(env, 'USE_STAGING_OAUTH')) oauthFileSuffix = '-staging-oauth'
  else if (readEnv(env, 'CLAUDE_CODE_CUSTOM_OAUTH_URL')) oauthFileSuffix = '-custom-oauth'

  return { oauthFileSuffix }
}

function getClaudeConfigDir(env = process.env, homeDir = home) {
  return readEnv(env, 'CLAUDE_CONFIG_DIR') || path.join(homeDir, '.claude')
}

function getClaudeKeychainService(env = process.env) {
  const { oauthFileSuffix } = getClaudeOauthConfig(env)
  return `${KEYCHAIN_SERVICE_PREFIX}${oauthFileSuffix}-credentials`
}

function getClaudePlan(oauth) {
  if (!oauth) return null

  let plan = oauth.subscriptionType || null
  if (!plan) return null

  const rateLimitTier = String(oauth.rateLimitTier || '')
  const tierMatch = rateLimitTier.match(/(\d+)x/)
  if (tierMatch && tierMatch[1] !== '1') {
    plan = `${plan}_${tierMatch[1]}x`
  }
  return plan
}

function toClaudeUsageSnapshot(data) {
  if (!data || typeof data !== 'object') return null

  const fiveHour = data.five_hour
  const sevenDay = data.seven_day

  return {
    fiveHourUtilization:
      fiveHour && typeof fiveHour.utilization === 'number' ? fiveHour.utilization : null,
    fiveHourResetsAt: fiveHour?.resets_at || null,
    sevenDayUtilization:
      sevenDay && typeof sevenDay.utilization === 'number' ? sevenDay.utilization : null,
    sevenDayResetsAt: sevenDay?.resets_at || null,
  }
}

function isClaudeUsageAvailable(data) {
  if (!data || typeof data !== 'object') return null

  const windows = [data.five_hour, data.seven_day].filter(Boolean)
  if (windows.length === 0) return null

  for (const window of windows) {
    if (typeof window.utilization !== 'number') return null
    if (window.utilization >= 100) return false
  }

  return true
}

function loadClaudeOauthFromFile({
  env = process.env,
  homeDir = home,
  readFileSync = fs.readFileSync,
} = {}) {
  const credPath = path.join(getClaudeConfigDir(env, homeDir), '.credentials.json')

  try {
    const raw = readFileSync(credPath, 'utf8')
    const parsed = tryParseCredentialJson(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth?.accessToken) return null
    return { oauth, source: 'file' }
  } catch {
    return null
  }
}

function loadClaudeOauthFromKeychain({
  env = process.env,
  execFileSync = childProcess.execFileSync,
} = {}) {
  try {
    const raw = execFileSync(
      'security',
      ['find-generic-password', '-s', getClaudeKeychainService(env), '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    )
    const parsed = tryParseCredentialJson(raw)
    const oauth = parsed?.claudeAiOauth
    if (!oauth?.accessToken) return null
    return { oauth, source: 'keychain' }
  } catch {
    return null
  }
}

function loadClaudeOauth(deps = {}) {
  return loadClaudeOauthFromFile(deps) || loadClaudeOauthFromKeychain(deps)
}

async function fetchClaudeUsage(accessToken, fetchImpl = globalThis.fetch) {
  if (!accessToken || typeof fetchImpl !== 'function') return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)

  try {
    const response = await fetchImpl(CLAUDE_USAGE_URL, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'agent-todo/1.0',
      },
      signal: controller.signal,
    })

    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** @returns {Promise<AgentSubscription>} */
export async function detectClaude({
  env = process.env,
  homeDir = home,
  accessSync = fs.accessSync,
  readFileSync = fs.readFileSync,
  execFileSync = childProcess.execFileSync,
  fetchImpl = globalThis.fetch,
} = {}) {
  const installed = hasExecutableOnPath('claude', env, accessSync)
  const credentials = loadClaudeOauth({ env, homeDir, readFileSync, execFileSync })
  const oauth = credentials?.oauth || null
  const plan = getClaudePlan(oauth)

  if (!installed) {
    return { installed: false, plan, available: false, reason: 'not_installed', usage: null }
  }

  if (!oauth?.accessToken) {
    return { installed: true, plan, available: false, reason: 'login_required', usage: null }
  }

  const usageData = await fetchClaudeUsage(oauth.accessToken, fetchImpl)
  const usage = toClaudeUsageSnapshot(usageData)
  const usageAvailable = isClaudeUsageAvailable(usageData)

  if (usageAvailable === false) {
    return { installed: true, plan, available: false, reason: 'usage_exhausted', usage }
  }

  return {
    installed: true,
    plan,
    available: true,
    reason: usageAvailable === null ? 'usage_unverified' : null,
    usage,
  }
}

/** @returns {AgentSubscription} */
export function detectCodex({
  env = process.env,
  homeDir = home,
  readFileSync = fs.readFileSync,
} = {}) {
  const candidates = [
    readEnv(env, 'CODEX_HOME') && path.join(readEnv(env, 'CODEX_HOME'), 'auth.json'),
    path.join(homeDir, '.config', 'codex', 'auth.json'),
    path.join(homeDir, '.codex', 'auth.json'),
  ].filter(Boolean)

  for (const credPath of candidates) {
    try {
      const raw = readFileSync(credPath, 'utf8')
      const creds = JSON.parse(raw)
      if (creds.tokens?.access_token) {
        return {
          installed: true,
          plan: 'plus',
          available: true,
          reason: null,
          usage: null,
        }
      }
      return {
        installed: true,
        plan: null,
        available: false,
        reason: 'login_required',
        usage: null,
      }
    } catch {
      // try next candidate
    }
  }

  return {
    installed: false,
    plan: null,
    available: false,
    reason: 'not_installed',
    usage: null,
  }
}

// Cache for 60 seconds to avoid repeated fs reads and usage checks.
let cache = null
let cacheTs = 0
let cachePromise = null
const CACHE_TTL = 60_000

async function getSubscriptions() {
  const now = Date.now()
  if (cache && now - cacheTs < CACHE_TTL) return cache
  if (cachePromise) return cachePromise

  cachePromise = (async () => {
    const next = {
      claude: await detectClaude(),
      codex: detectCodex(),
    }
    cache = next
    cacheTs = Date.now()
    return next
  })()

  try {
    return await cachePromise
  } finally {
    cachePromise = null
  }
}

export function __resetSubscriptionCacheForTests() {
  cache = null
  cacheTs = 0
  cachePromise = null
}

export async function handleSubscriptionRoutes(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/subscriptions') {
    return json(res, 200, await getSubscriptions())
  }
  return false
}
