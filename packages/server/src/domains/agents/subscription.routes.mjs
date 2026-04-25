/**
 * Subscription detection routes.
 *
 * GET /api/subscriptions — detect installed agents and subscription tiers.
 *
 * Claude detection supports both the legacy credentials file and the current
 * macOS Keychain-backed login flow used by Claude Code. Codex detection reads
 * the local auth store and resolves live plan/rate-limit state from OpenAI.
 */
import childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { json } from '#infra/http/http.mjs'

const CLAUDE_USAGE_URL = 'https://api.anthropic.com/api/oauth/usage'
const KEYCHAIN_SERVICE_PREFIX = 'Claude Code'
const CODEX_USAGE_URL = 'https://chatgpt.com/backend-api/wham/usage'
const CODEX_REFRESH_URL = 'https://auth.openai.com/oauth/token'
const CODEX_CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
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
 *   creditsRemaining: number | null
 *   creditsUnlimited: boolean | null
 * }} AgentUsageSnapshot
 */

/**
 * @typedef {{
 *   installed: boolean
 *   plan: string | null
 *   available: boolean
 *   reason: string | null
 *   usage: AgentUsageSnapshot | null
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

function clampNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function normalizeNullableString(value) {
  if (value === undefined || value === null) return null
  const text = String(value).trim()
  return text || null
}

function parseJwtPayload(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length < 2) return null

  let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  while (payload.length % 4 !== 0) payload += '='

  try {
    const decoded = Buffer.from(payload, 'base64').toString('utf8')
    return tryParseJson(decoded)
  } catch {
    return null
  }
}

function epochSecondsToIso(value) {
  const parsed = parseNumber(value)
  if (parsed === null) return null
  const date = new Date(parsed * 1000)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
    creditsRemaining: null,
    creditsUnlimited: null,
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

function getCodexCredentialCandidates(env = process.env, homeDir = home) {
  return [
    readEnv(env, 'CODEX_HOME') && path.join(readEnv(env, 'CODEX_HOME'), 'auth.json'),
    path.join(homeDir, '.codex', 'auth.json'),
    path.join(homeDir, '.config', 'codex', 'auth.json'),
  ].filter(Boolean)
}

function parseCodexCredentials(raw) {
  const parsed = tryParseJson(raw)
  if (!parsed || typeof parsed !== 'object') return null

  const apiKey = normalizeNullableString(parsed.OPENAI_API_KEY)
  if (apiKey) {
    return {
      accessToken: apiKey,
      refreshToken: '',
      idToken: null,
      accountId: null,
      lastRefresh: null,
      authMode: 'api_key',
    }
  }

  const tokens = parsed.tokens
  if (!tokens || typeof tokens !== 'object') return null

  const accessToken = normalizeNullableString(tokens.access_token || tokens.accessToken)
  if (!accessToken) return null

  return {
    accessToken,
    refreshToken: normalizeNullableString(tokens.refresh_token || tokens.refreshToken) || '',
    idToken: normalizeNullableString(tokens.id_token || tokens.idToken),
    accountId: normalizeNullableString(tokens.account_id || tokens.accountId),
    lastRefresh: normalizeNullableString(parsed.last_refresh),
    authMode: 'oauth',
  }
}

function loadCodexCredentials({
  env = process.env,
  homeDir = home,
  readFileSync = fs.readFileSync,
} = {}) {
  for (const credPath of getCodexCredentialCandidates(env, homeDir)) {
    try {
      const raw = readFileSync(credPath, 'utf8')
      const credentials = parseCodexCredentials(raw)
      if (credentials) return { credentials, path: credPath }
    } catch {
      // try next candidate
    }
  }
  return null
}

function getCodexJwtClaims(credentials) {
  const payload = parseJwtPayload(credentials?.idToken)
  const auth = payload?.['https://api.openai.com/auth']
  const profile = payload?.['https://api.openai.com/profile']
  return {
    payload,
    auth: auth && typeof auth === 'object' ? auth : null,
    profile: profile && typeof profile === 'object' ? profile : null,
  }
}

function getCodexPlanFromCredentials(credentials) {
  const { payload, auth } = getCodexJwtClaims(credentials)
  return (
    normalizeNullableString(auth?.chatgpt_plan_type) ||
    normalizeNullableString(payload?.chatgpt_plan_type) ||
    null
  )
}

function getCodexAccountId(credentials) {
  const { payload, auth } = getCodexJwtClaims(credentials)
  return (
    normalizeNullableString(credentials?.accountId) ||
    normalizeNullableString(auth?.chatgpt_account_id) ||
    normalizeNullableString(payload?.chatgpt_account_id) ||
    null
  )
}

function toCodexUsageSnapshot(data) {
  const primary = data?.rate_limit?.primary_window
  const secondary = data?.rate_limit?.secondary_window
  const credits = data?.credits

  return {
    fiveHourUtilization: clampNumber(primary?.used_percent),
    fiveHourResetsAt: epochSecondsToIso(primary?.reset_at),
    sevenDayUtilization: clampNumber(secondary?.used_percent),
    sevenDayResetsAt: epochSecondsToIso(secondary?.reset_at),
    creditsRemaining: parseNumber(credits?.balance),
    creditsUnlimited: typeof credits?.unlimited === 'boolean' ? credits.unlimited : null,
  }
}

function isCodexUsageAvailable(data) {
  if (!data || typeof data !== 'object') return null

  const windows = [data?.rate_limit?.primary_window, data?.rate_limit?.secondary_window].filter(
    Boolean
  )
  const credits = data?.credits
  const creditsUnlimited = credits?.unlimited === true
  const creditsRemaining = parseNumber(credits?.balance)

  if (creditsUnlimited) return true
  if (typeof creditsRemaining === 'number' && creditsRemaining > 0) return true

  if (windows.length === 0) {
    if (typeof creditsRemaining === 'number') return creditsRemaining > 0
    return null
  }

  const utilization = windows
    .map(window => clampNumber(window?.used_percent))
    .filter(value => typeof value === 'number')

  if (utilization.length !== windows.length) return null
  if (utilization.some(value => value < 100)) return true
  if (typeof creditsRemaining === 'number') return creditsRemaining > 0
  return false
}

async function refreshCodexAccessToken(credentials, fetchImpl = globalThis.fetch) {
  if (!credentials?.refreshToken || typeof fetchImpl !== 'function') return null

  const response = await fetchImpl(CODEX_REFRESH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: CODEX_CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: credentials.refreshToken,
      scope: 'openid profile email',
    }),
  })

  if (!response.ok) {
    const error = new Error(`token refresh failed with status ${response.status}`)
    error.status = response.status
    throw error
  }

  const parsed = await response.json()
  return {
    ...credentials,
    accessToken: normalizeNullableString(parsed.access_token) || credentials.accessToken,
    refreshToken: normalizeNullableString(parsed.refresh_token) || credentials.refreshToken,
    idToken: normalizeNullableString(parsed.id_token) || credentials.idToken,
    lastRefresh: new Date().toISOString(),
  }
}

async function fetchCodexUsage(credentials, fetchImpl = globalThis.fetch) {
  if (!credentials?.accessToken || typeof fetchImpl !== 'function') return null

  const headers = {
    Authorization: `Bearer ${credentials.accessToken}`,
    Accept: 'application/json',
    'User-Agent': 'agentodo/1.0',
  }
  const accountId = getCodexAccountId(credentials)
  if (accountId) headers['ChatGPT-Account-Id'] = accountId

  const response = await fetchImpl(CODEX_USAGE_URL, {
    method: 'GET',
    headers,
  })

  if (response.status === 401 || response.status === 403) {
    const error = new Error(`usage auth failed with status ${response.status}`)
    error.status = response.status
    throw error
  }

  if (!response.ok) return null
  return await response.json()
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
        'User-Agent': 'agentodo/1.0',
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

/** @returns {Promise<AgentSubscription>} */
export async function detectCodex({
  env = process.env,
  homeDir = home,
  accessSync = fs.accessSync,
  readFileSync = fs.readFileSync,
  fetchImpl = globalThis.fetch,
} = {}) {
  const installed = hasExecutableOnPath('codex', env, accessSync)
  const auth = loadCodexCredentials({ env, homeDir, readFileSync })
  const credentials = auth?.credentials || null
  const fallbackPlan = getCodexPlanFromCredentials(credentials)

  if (!installed) {
    return {
      installed: false,
      plan: fallbackPlan,
      available: false,
      reason: 'not_installed',
      usage: null,
    }
  }

  if (!credentials?.accessToken) {
    return {
      installed: true,
      plan: fallbackPlan,
      available: false,
      reason: 'login_required',
      usage: null,
    }
  }

  if (credentials.authMode === 'api_key') {
    return {
      installed: true,
      plan: null,
      available: true,
      reason: 'api_key_auth',
      usage: null,
    }
  }

  let liveCredentials = credentials
  let usageData = null
  let reason = null

  try {
    usageData = await fetchCodexUsage(liveCredentials, fetchImpl)
  } catch (error) {
    if ((error?.status === 401 || error?.status === 403) && liveCredentials.refreshToken) {
      try {
        liveCredentials = await refreshCodexAccessToken(liveCredentials, fetchImpl)
        usageData = await fetchCodexUsage(liveCredentials, fetchImpl)
      } catch (refreshError) {
        if (refreshError?.status === 401 || refreshError?.status === 403) {
          return {
            installed: true,
            plan: fallbackPlan,
            available: false,
            reason: 'login_required',
            usage: null,
          }
        }
      }
    } else if (error?.status === 401 || error?.status === 403) {
      return {
        installed: true,
        plan: fallbackPlan,
        available: false,
        reason: 'login_required',
        usage: null,
      }
    }
  }

  const plan =
    normalizeNullableString(usageData?.plan_type) || getCodexPlanFromCredentials(liveCredentials)
  const usage = usageData ? toCodexUsageSnapshot(usageData) : null
  const usageAvailable = isCodexUsageAvailable(usageData)

  if (usageAvailable === false) {
    return { installed: true, plan, available: false, reason: 'usage_exhausted', usage }
  }

  if (usageAvailable === null) {
    reason = 'usage_unverified'
  }

  return {
    installed: true,
    plan,
    available: true,
    reason,
    usage,
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
      codex: await detectCodex(),
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
