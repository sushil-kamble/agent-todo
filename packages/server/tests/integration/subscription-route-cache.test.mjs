import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function buildUsageResponse(body) {
  return {
    ok: true,
    status: 200,
    async json() {
      return body
    },
  }
}

function createExecutable(filePath) {
  writeFileSync(filePath, '#!/bin/sh\nexit 0\n')
  chmodSync(filePath, 0o755)
}

function createResponseCapture() {
  const state = { status: null, headers: null, body: '' }
  return {
    res: {
      writeHead(status, headers) {
        state.status = status
        state.headers = headers
      },
      end(body) {
        state.body = String(body ?? '')
      },
    },
    read() {
      return {
        status: state.status,
        headers: state.headers,
        body: state.body ? JSON.parse(state.body) : null,
      }
    },
  }
}

describe('subscription route cache', () => {
  let root
  let homeDir
  let binDir

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'agent-todo-subscription-cache-'))
    homeDir = join(root, 'home')
    binDir = join(root, 'bin')

    mkdirSync(join(homeDir, '.claude'), { recursive: true })
    mkdirSync(join(homeDir, '.codex'), { recursive: true })
    mkdirSync(binDir, { recursive: true })

    createExecutable(join(binDir, 'claude'))
    createExecutable(join(binDir, 'codex'))

    writeFileSync(
      join(homeDir, '.claude', '.credentials.json'),
      JSON.stringify({
        claudeAiOauth: {
          accessToken: 'claude-token',
          subscriptionType: 'pro',
        },
      })
    )
    writeFileSync(
      join(homeDir, '.codex', 'auth.json'),
      JSON.stringify({
        tokens: {
          access_token: 'codex-token',
          id_token: 'header.eyJjaGF0Z3B0X3BsYW5fdHlwZSI6InBybyJ9.sig',
        },
      })
    )

    vi.resetModules()
    vi.stubEnv('PATH', binDir)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.doUnmock('node:os')
    rmSync(root, { recursive: true, force: true })
  })

  it('dedupes concurrent GET requests and resets the cache for future reads', async () => {
    const fetchImpl = vi.fn(async url => {
      if (url === 'https://api.anthropic.com/api/oauth/usage') {
        return buildUsageResponse({
          five_hour: { utilization: 10, resets_at: '2026-04-10T23:00:00.467658+00:00' },
          seven_day: { utilization: 20, resets_at: '2026-04-17T18:00:00.467674+00:00' },
        })
      }
      if (url === 'https://chatgpt.com/backend-api/wham/usage') {
        return buildUsageResponse({
          plan_type: 'pro',
          rate_limit: {
            primary_window: { used_percent: 30, reset_at: 1770000000 },
            secondary_window: { used_percent: 40, reset_at: 1770600000 },
          },
          credits: { has_credits: true, unlimited: false, balance: '3' },
        })
      }
      throw new Error(`unexpected url: ${url}`)
    })
    vi.stubGlobal('fetch', fetchImpl)
    vi.doMock('node:os', () => ({
      default: { homedir: () => homeDir },
      homedir: () => homeDir,
    }))

    const { __resetSubscriptionCacheForTests, handleSubscriptionRoutes } = await import(
      '#domains/agents/subscription.routes.mjs'
    )

    const first = createResponseCapture()
    const second = createResponseCapture()
    await Promise.all([
      handleSubscriptionRoutes(
        { method: 'GET', url: 'http://localhost/api/subscriptions' },
        first.res,
        '/api/subscriptions'
      ),
      handleSubscriptionRoutes(
        { method: 'GET', url: 'http://localhost/api/subscriptions' },
        second.res,
        '/api/subscriptions'
      ),
    ])

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(first.read().status).toBe(200)
    expect(first.read().body).toMatchObject({
      claude: { installed: true, available: true, plan: 'pro' },
      codex: { installed: true, available: true, plan: 'pro' },
    })
    expect(second.read().body).toEqual(first.read().body)

    const third = createResponseCapture()
    await handleSubscriptionRoutes(
      { method: 'GET', url: 'http://localhost/api/subscriptions' },
      third.res,
      '/api/subscriptions'
    )
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    __resetSubscriptionCacheForTests()

    const fourth = createResponseCapture()
    await handleSubscriptionRoutes(
      { method: 'GET', url: 'http://localhost/api/subscriptions' },
      fourth.res,
      '/api/subscriptions'
    )
    expect(fetchImpl).toHaveBeenCalledTimes(4)
    expect(fourth.read().body).toEqual(first.read().body)
  })
})
