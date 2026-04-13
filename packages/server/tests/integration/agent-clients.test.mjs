import { delimiter } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildClaudeProcessEnv, ClaudeClient } from '#infra/agent-clients/claude.mjs'
import { CodexClient } from '#infra/agent-clients/codex.mjs'
import { ASK_MODE_PROMPT, getAgentSystemPrompt } from '#infra/agent-clients/config.mjs'
import {
  CLAUDE_ASK_MODE_TOOLS,
  canUseClaudeAskModeTool,
  isMutatingShellCommand,
  resolveAgentRunProfile,
} from '#infra/agent-clients/run-profile.mjs'

describe('agent client configuration', () => {
  it('normalizes codex constructor state for defaults and unsupported fast mode', () => {
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'code',
        model: 'not-a-real-model',
        effort: 'high',
        fast_mode: 1,
      },
    })

    expect(client.model).toBe('gpt-5.4')
    expect(client.effort).toBe('high')
    expect(client.fastMode).toBe(true)
  })

  it('drops fast mode for unsupported codex models', () => {
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'code',
        model: 'gpt-5.3-codex',
        effort: 'medium',
        fast_mode: 1,
      },
    })

    expect(client.model).toBe('gpt-5.3-codex')
    expect(client.fastMode).toBe(false)
  })

  it('includes serviceTier only when codex fast mode is enabled', async () => {
    const requests = []
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'code',
        model: 'gpt-5.4',
        effort: 'high',
        fastMode: true,
      },
    })
    client._request = async (method, params) => {
      requests.push({ method, params })
      if (method === 'thread/start') return { thread: { id: 'thread-fast' } }
      return {}
    }

    await client.startThread()
    await client.sendUserText('ship it')

    expect(requests[0]).toMatchObject({
      method: 'thread/start',
      params: {
        model: 'gpt-5.4',
        serviceTier: 'fast',
      },
    })
    expect(requests[1]).toMatchObject({
      method: 'turn/start',
      params: {
        threadId: 'thread-fast',
        effort: 'high',
        serviceTier: 'fast',
      },
    })
  })

  it('omits serviceTier when resuming or sending with fast mode disabled', async () => {
    const requests = []
    const client = new CodexClient({
      cwd: '/tmp/project',
      threadId: 'thread-slow',
      task: {
        mode: 'code',
        model: 'gpt-5.4-mini',
        effort: 'medium',
        fastMode: true,
      },
    })
    client._request = async (method, params) => {
      requests.push({ method, params })
      if (method === 'thread/resume') return { thread: { id: 'thread-slow' } }
      return {}
    }

    await client.startThread()
    await client.sendUserText('resume')

    expect(requests[0].method).toBe('thread/resume')
    expect(requests[0].params.serviceTier).toBeUndefined()
    expect(requests[1].method).toBe('turn/start')
    expect(requests[1].params.serviceTier).toBeUndefined()
  })

  it('falls back to the default claude model when task input is invalid', () => {
    const client = new ClaudeClient({
      cwd: '/tmp/project',
      task: {
        mode: 'code',
        model: 'gpt-5.4',
        effort: 'high',
      },
    })

    expect(client.taskModel).toBe('claude-sonnet-4-6')
    expect(client.taskEffort).toBe('high')
  })

  it('prepends the current node binary directory for claude child processes', () => {
    const env = buildClaudeProcessEnv({ PATH: '/usr/local/bin' }, '/opt/node/bin/node')

    expect(env.PATH).toBe(`/opt/node/bin${delimiter}/usr/local/bin`)
  })

  it('does not duplicate the current node binary directory in PATH', () => {
    const env = buildClaudeProcessEnv(
      { PATH: `/opt/node/bin${delimiter}/usr/local/bin` },
      '/opt/node/bin/node'
    )

    expect(env.PATH).toBe(`/opt/node/bin${delimiter}/usr/local/bin`)
  })

  it('returns only the ask prompt for untyped ask-mode tasks', () => {
    expect(getAgentSystemPrompt({ mode: 'ask', taskType: null })).toContain(ASK_MODE_PROMPT)
    expect(getAgentSystemPrompt({ mode: 'ask', taskType: null })).toContain(
      'No explicit task type is selected.'
    )
    expect(getAgentSystemPrompt({ mode: 'code', taskType: null })).toBeNull()
  })

  it('composes ask mode and the task-type prompt for typed ask-mode tasks', () => {
    const prompt = getAgentSystemPrompt({ mode: 'ask', taskType: 'code_review' })

    expect(prompt).toContain(ASK_MODE_PROMPT)
    expect(prompt).toContain('<task_type>')
    expect(prompt).toContain('Code Review')
    expect(prompt).toContain('Identify the highest-value issues')
  })

  it('uses a Claude preset prompt with appended task instructions in ask mode', () => {
    const profile = resolveAgentRunProfile({
      mode: 'ask',
      taskType: 'code_review',
    })

    expect(profile.claude.systemPrompt).toMatchObject({
      type: 'preset',
      preset: 'claude_code',
    })
    expect(profile.claude.systemPrompt.append).toContain(ASK_MODE_PROMPT)
    expect(profile.claude.systemPrompt.append).toContain('<task_type>')
    expect(profile.claude.systemPrompt.append).toContain('Code Review')
    expect(profile.claude.tools).toEqual(CLAUDE_ASK_MODE_TOOLS)
  })

  it('blocks mutating ask-mode bash commands for Claude', async () => {
    expect(isMutatingShellCommand('git commit -m "ship it"')).toBe(true)
    expect(isMutatingShellCommand('pnpm test --filter server')).toBe(false)

    await expect(
      canUseClaudeAskModeTool('Bash', { command: 'git commit -m "ship it"' })
    ).resolves.toMatchObject({
      behavior: 'deny',
    })

    await expect(
      canUseClaudeAskModeTool('Bash', { command: 'pnpm test --filter server' })
    ).resolves.toMatchObject({
      behavior: 'allow',
    })
  })

  it('stores codex task instructions on the thread instead of prepending every turn', async () => {
    const requests = []
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'code',
        taskType: 'write_tests',
      },
    })
    client._request = async (method, params) => {
      requests.push({ method, params })
      if (method === 'thread/start') return { thread: { id: 'thread-tests' } }
      return {}
    }

    await client.startThread()
    await client.sendUserText('Add regression coverage')

    expect(requests[0]).toMatchObject({
      method: 'thread/start',
      params: {
        model: 'gpt-5.4',
        sandbox: 'danger-full-access',
        approvalPolicy: 'never',
      },
    })
    expect(requests[0].params.developerInstructions).toContain(
      'You are handling a **Write Tests** task.'
    )
    expect(requests[1]).toMatchObject({
      method: 'turn/start',
      params: {
        threadId: 'thread-tests',
      },
    })
    expect(requests[1].params.input[0].text).toBe('Add regression coverage')
  })

  it('switches codex ask-mode threads to read-only policy', async () => {
    const requests = []
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'ask',
        taskType: 'code_review',
      },
    })
    client._request = async (method, params) => {
      requests.push({ method, params })
      if (method === 'thread/start') return { thread: { id: 'thread-ask' } }
      return {}
    }

    await client.startThread()
    await client.sendUserText('Review the current changes')

    expect(requests[0]).toMatchObject({
      method: 'thread/start',
      params: {
        sandbox: 'read-only',
        approvalPolicy: 'on-request',
      },
    })
    expect(requests[0].params.developerInstructions).toContain(ASK_MODE_PROMPT)
    expect(requests[1].params.input[0].text).toBe('Review the current changes')
  })

  it('declines codex approval requests in ask mode', () => {
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: {
        mode: 'ask',
      },
    })
    const sent = []
    client._send = msg => sent.push(msg)

    client._handleServerRequest({
      id: 1,
      method: 'item/commandExecution/requestApproval',
    })

    expect(sent[0]).toMatchObject({
      id: 1,
      result: {
        decision: 'decline',
      },
    })
  })

  it('streams Claude reasoning deltas separately from final agent text', () => {
    const client = new ClaudeClient({
      cwd: '/tmp/project',
      task: { mode: 'ask' },
    })
    const started = []
    const deltas = []
    const completed = []

    client.on('itemStarted', payload => started.push(payload))
    client.on('reasoningDelta', payload => deltas.push(payload))
    client.on('item', payload => completed.push(payload))

    client._handleStreamEvent({
      event: {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'thinking' },
      },
    })
    const reasoningItemId = started[0].item.id
    client._handleStreamEvent({
      event: {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'thinking_delta', thinking: 'Collecting evidence' },
      },
    })
    client._handleStreamEvent({
      event: {
        type: 'content_block_stop',
        index: 0,
      },
    })

    expect(started[0]).toMatchObject({
      item: {
        type: 'reasoning',
        id: reasoningItemId,
        provider: 'claude',
        reasoningFormat: 'summary',
      },
    })
    expect(deltas).toEqual([
      {
        itemId: reasoningItemId,
        delta: 'Collecting evidence',
        provider: 'claude',
        reasoningFormat: 'summary',
      },
    ])
    expect(completed[0]).toMatchObject({
      item: {
        type: 'reasoning',
        id: reasoningItemId,
        content: 'Collecting evidence',
        provider: 'claude',
        reasoningFormat: 'summary',
      },
    })
  })

  it('captures Codex reasoning delta events with structured metadata', () => {
    const client = new CodexClient({
      cwd: '/tmp/project',
      task: { mode: 'code' },
    })
    const deltas = []
    const items = []

    client.on('reasoningDelta', payload => deltas.push(payload))
    client.on('item', payload => items.push(payload))

    client._handleNotification({
      method: 'item/reasoning/summaryTextDelta',
      params: { itemId: 'reasoning-1', delta: 'Step one' },
    })
    client._handleNotification({
      method: 'item/reasoning/summaryPartAdded',
      params: { itemId: 'reasoning-1' },
    })
    client._handleNotification({
      method: 'item/completed',
      params: {
        item: {
          type: 'reasoning',
          id: 'reasoning-1',
          summary: [{ text: 'Step one' }, { text: 'Step two' }],
        },
      },
    })

    expect(deltas).toEqual([
      {
        itemId: 'reasoning-1',
        delta: 'Step one',
        provider: 'codex',
        reasoningFormat: 'summary',
      },
      {
        itemId: 'reasoning-1',
        delta: '\n\n',
        provider: 'codex',
        reasoningFormat: 'summary',
      },
    ])
    expect(items[0]).toMatchObject({
      item: {
        type: 'reasoning',
        id: 'reasoning-1',
        provider: 'codex',
        reasoningFormat: 'summary',
      },
    })
  })
})
