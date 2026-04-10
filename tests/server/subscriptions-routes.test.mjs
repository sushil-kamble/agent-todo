import { describe, expect, it } from 'vitest'
import { detectClaude } from '../../server/routes/subscriptions.mjs'

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
})
