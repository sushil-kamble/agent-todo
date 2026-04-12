import { describe, expect, it } from 'vitest'
import { detectClaude, detectCodex } from '#domains/agents/subscription.routes.mjs'

function missingFile() {
  throw new Error('missing')
}

function missingKeychain() {
  throw new Error('missing')
}

function buildUsageResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body
    },
  }
}

describe('subscription detection', () => {
  it('treats keychain-backed Claude auth as available when live usage has headroom', async () => {
    const result = await detectClaude({
      env: { PATH: '/Applications/cmux.app/Contents/Resources/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync: missingFile,
      execFileSync(command, args) {
        expect(command).toBe('security')
        expect(args).toEqual(['find-generic-password', '-s', 'Claude Code-credentials', '-w'])
        return JSON.stringify({
          claudeAiOauth: {
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            subscriptionType: 'pro',
            rateLimitTier: 'default_claude_ai',
          },
        })
      },
      fetchImpl: async (_url, init) => {
        expect(init.headers.Authorization).toBe('Bearer access-token')
        return buildUsageResponse({
          five_hour: { utilization: 6, resets_at: '2026-04-10T23:00:00.467658+00:00' },
          seven_day: { utilization: 1, resets_at: '2026-04-17T18:00:00.467674+00:00' },
          extra_usage: { is_enabled: true, monthly_limit: 2000, used_credits: 2097 },
        })
      },
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
      reason: null,
      usage: {
        fiveHourUtilization: 6,
        sevenDayUtilization: 1,
      },
    })
  })

  it('detects Claude from PATH even when credentials are missing', async () => {
    const result = await detectClaude({
      env: { PATH: '/Applications/cmux.app/Contents/Resources/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync: missingFile,
      execFileSync: missingKeychain,
      fetchImpl: async () => {
        throw new Error('usage should not be fetched without auth')
      },
    })

    expect(result).toEqual({
      installed: true,
      plan: null,
      available: false,
      reason: 'login_required',
      usage: null,
    })
  })

  it('marks Claude as not installed when the binary is missing', async () => {
    const result = await detectClaude({
      env: { PATH: '/missing/bin' },
      homeDir: '/Users/tester',
      accessSync() {
        throw new Error('missing')
      },
      readFileSync: missingFile,
      execFileSync: missingKeychain,
    })

    expect(result).toEqual({
      installed: false,
      plan: null,
      available: false,
      reason: 'not_installed',
      usage: null,
    })
  })

  it('prefers Claude credentials from file before checking the keychain', async () => {
    const result = await detectClaude({
      env: { PATH: '/Applications/cmux.app/Contents/Resources/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync(candidatePath) {
        expect(candidatePath).toBe('/Users/tester/.claude/.credentials.json')
        return JSON.stringify({
          claudeAiOauth: {
            accessToken: 'file-token',
            subscriptionType: 'pro',
          },
        })
      },
      execFileSync() {
        throw new Error('keychain should not be consulted when file auth exists')
      },
      fetchImpl: async (_url, init) => {
        expect(init.headers.Authorization).toBe('Bearer file-token')
        return buildUsageResponse({
          five_hour: { utilization: 10, resets_at: '2026-04-10T23:00:00.467658+00:00' },
          seven_day: { utilization: 5, resets_at: '2026-04-17T18:00:00.467674+00:00' },
        })
      },
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
      reason: null,
    })
  })

  it('reports Claude usage as unverified when live usage cannot be read', async () => {
    const result = await detectClaude({
      env: { PATH: '/Applications/cmux.app/Contents/Resources/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          claudeAiOauth: {
            accessToken: 'access-token',
            subscriptionType: 'pro',
          },
        })
      },
      execFileSync: missingKeychain,
      fetchImpl: async () => ({
        ok: false,
        status: 503,
        async json() {
          return {}
        },
      }),
    })

    expect(result).toEqual({
      installed: true,
      plan: 'pro',
      available: true,
      reason: 'usage_unverified',
      usage: null,
    })
  })

  it('marks Claude unavailable when live usage explicitly reports exhausted limits', async () => {
    const result = await detectClaude({
      env: { PATH: '/Applications/cmux.app/Contents/Resources/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync: missingFile,
      execFileSync() {
        return JSON.stringify({
          claudeAiOauth: {
            accessToken: 'access-token',
            subscriptionType: 'max',
            rateLimitTier: 'rate_limit_tier_max_5x',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          five_hour: { utilization: 100, resets_at: '2026-04-10T23:00:00.467658+00:00' },
          seven_day: { utilization: 25, resets_at: '2026-04-17T18:00:00.467674+00:00' },
        }),
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'max_5x',
      available: false,
      reason: 'usage_exhausted',
      usage: {
        fiveHourUtilization: 100,
        sevenDayUtilization: 25,
      },
    })
  })

  it('reads Claude keychain credentials from the env-specific service name', async () => {
    const result = await detectClaude({
      env: {
        PATH: '/Applications/cmux.app/Contents/Resources/bin',
        CLAUDE_CODE_CUSTOM_OAUTH_URL: 'https://example.com/oauth',
      },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/Applications/cmux.app/Contents/Resources/bin/claude') return
        throw new Error('missing')
      },
      readFileSync: missingFile,
      execFileSync(command, args) {
        expect(command).toBe('security')
        expect(args).toEqual(['find-generic-password', '-s', 'Claude Code-custom-oauth-credentials', '-w'])
        return JSON.stringify({
          claudeAiOauth: {
            accessToken: 'custom-token',
            subscriptionType: 'max',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          five_hour: { utilization: 15, resets_at: '2026-04-10T23:00:00.467658+00:00' },
          seven_day: { utilization: 20, resets_at: '2026-04-17T18:00:00.467674+00:00' },
        }),
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'max',
      available: true,
    })
  })

  it('detects Codex plan and live limits from auth.json usage data', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync(candidatePath) {
        expect(candidatePath).toBe('/Users/tester/.codex/auth.json')
        return JSON.stringify({
          tokens: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            id_token:
              'header.eyJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20iLCJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifQ.sig',
          },
        })
      },
      fetchImpl: async (url, init) => {
        expect(url).toBe('https://chatgpt.com/backend-api/wham/usage')
        expect(init.headers.Authorization).toBe('Bearer access-token')
        return buildUsageResponse({
          plan_type: 'pro',
          rate_limit: {
            primary_window: { used_percent: 12, reset_at: 1770000000 },
            secondary_window: { used_percent: 43, reset_at: 1770600000 },
          },
          credits: { has_credits: true, unlimited: false, balance: '7' },
        })
      },
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
      reason: null,
      usage: {
        fiveHourUtilization: 12,
        sevenDayUtilization: 43,
        creditsRemaining: 7,
        creditsUnlimited: false,
      },
    })
  })

  it('marks Codex as not installed when the binary is missing', async () => {
    const result = await detectCodex({
      env: { PATH: '/missing/bin' },
      homeDir: '/Users/tester',
      accessSync() {
        throw new Error('missing')
      },
      readFileSync: missingFile,
    })

    expect(result).toEqual({
      installed: false,
      plan: null,
      available: false,
      reason: 'not_installed',
      usage: null,
    })
  })

  it('prefers CODEX_HOME auth.json before fallback locations', async () => {
    const reads = []
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin', CODEX_HOME: '/custom/codex-home' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync(candidatePath) {
        reads.push(candidatePath)
        if (candidatePath === '/custom/codex-home/auth.json') {
          return JSON.stringify({
            tokens: {
              access_token: 'access-token',
              id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
            },
          })
        }
        throw new Error('should not read fallback locations after CODEX_HOME succeeds')
      },
      fetchImpl: async () =>
        buildUsageResponse({
          plan_type: 'pro',
          rate_limit: {
            primary_window: { used_percent: 10, reset_at: 1770000000 },
            secondary_window: { used_percent: 20, reset_at: 1770600000 },
          },
          credits: { has_credits: true, unlimited: false, balance: '2' },
        }),
    })

    expect(reads).toEqual(['/custom/codex-home/auth.json'])
    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
    })
  })

  it('falls back to the JWT plan when Codex live usage omits plan_type', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'access-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifQ.sig',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          rate_limit: {
            primary_window: { used_percent: 12, reset_at: 1770000000 },
          },
          credits: { has_credits: true, unlimited: false, balance: '1' },
        }),
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'plus',
      available: true,
      reason: null,
    })
  })

  it('refreshes the Codex access token when usage returns 401 and retries successfully', async () => {
    let usageRequests = 0
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'expired-token',
            refresh_token: 'refresh-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
          },
        })
      },
      fetchImpl: async (url, init) => {
        if (url === 'https://chatgpt.com/backend-api/wham/usage') {
          usageRequests += 1
          if (usageRequests === 1) return { ok: false, status: 401, async json() { return {} } }
          expect(init.headers.Authorization).toBe('Bearer refreshed-token')
          return buildUsageResponse({
            plan_type: 'pro',
            rate_limit: {
              primary_window: { used_percent: 30, reset_at: 1770000000 },
              secondary_window: { used_percent: 40, reset_at: 1770600000 },
            },
            credits: { has_credits: true, unlimited: false, balance: '5' },
          })
        }

        expect(url).toBe('https://auth.openai.com/oauth/token')
        return buildUsageResponse({
          access_token: 'refreshed-token',
          refresh_token: 'refresh-token',
          id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
        })
      },
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
      reason: null,
      usage: {
        fiveHourUtilization: 30,
        sevenDayUtilization: 40,
      },
    })
  })

  it('reports Codex login_required when token refresh cannot recover auth', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'expired-token',
            refresh_token: 'refresh-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
          },
        })
      },
      fetchImpl: async url => {
        if (url === 'https://chatgpt.com/backend-api/wham/usage') {
          return { ok: false, status: 401, async json() { return {} } }
        }
        return { ok: false, status: 401, async json() { return {} } }
      },
    })

    expect(result).toEqual({
      installed: true,
      plan: 'pro',
      available: false,
      reason: 'login_required',
      usage: null,
    })
  })

  it('reports Codex usage as unverified when live usage is incomplete', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'access-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          plan_type: 'pro',
          rate_limit: {
            primary_window: { used_percent: 'not-a-number', reset_at: 1770000000 },
          },
        }),
    })

    expect(result).toEqual({
      installed: true,
      plan: 'pro',
      available: true,
      reason: 'usage_unverified',
      usage: {
        fiveHourUtilization: null,
        fiveHourResetsAt: '2026-02-02T02:40:00.000Z',
        sevenDayUtilization: null,
        sevenDayResetsAt: null,
        creditsRemaining: null,
        creditsUnlimited: null,
      },
    })
  })

  it('keeps Codex available when unlimited credits are reported', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'access-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          plan_type: 'pro',
          credits: { has_credits: true, unlimited: true, balance: 0 },
        }),
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: true,
      reason: null,
      usage: {
        creditsRemaining: 0,
        creditsUnlimited: true,
      },
    })
  })

  it('keeps Codex available in API key mode but reports no ChatGPT plan data', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync(candidatePath) {
        expect(candidatePath).toBe('/Users/tester/.codex/auth.json')
        return JSON.stringify({
          OPENAI_API_KEY: 'sk-test',
        })
      },
      fetchImpl: async () => {
        throw new Error('usage should not be fetched for API key auth')
      },
    })

    expect(result).toEqual({
      installed: true,
      plan: null,
      available: true,
      reason: 'api_key_auth',
      usage: null,
    })
  })

  it('marks Codex unavailable when both included limits and credits are exhausted', async () => {
    const result = await detectCodex({
      env: { PATH: '/usr/local/bin' },
      homeDir: '/Users/tester',
      accessSync(candidatePath) {
        if (candidatePath === '/usr/local/bin/codex') return
        throw new Error('missing')
      },
      readFileSync() {
        return JSON.stringify({
          tokens: {
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
          },
        })
      },
      fetchImpl: async () =>
        buildUsageResponse({
          plan_type: 'pro',
          rate_limit: {
            primary_window: { used_percent: 100, reset_at: 1770000000 },
            secondary_window: { used_percent: 100, reset_at: 1770600000 },
          },
          credits: { has_credits: false, unlimited: false, balance: 0 },
        }),
    })

    expect(result).toMatchObject({
      installed: true,
      plan: 'pro',
      available: false,
      reason: 'usage_exhausted',
      usage: {
        fiveHourUtilization: 100,
        sevenDayUtilization: 100,
        creditsRemaining: 0,
        creditsUnlimited: false,
      },
    })
  })
})
