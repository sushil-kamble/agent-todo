import { delimiter } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildClaudeProcessEnv, ClaudeClient } from '#infra/agent-clients/claude.mjs'
import { CodexClient } from '#infra/agent-clients/codex.mjs'
import { ASK_MODE_PROMPT, getAgentSystemPrompt } from '#infra/agent-clients/config.mjs'

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
    expect(getAgentSystemPrompt({ mode: 'ask', taskType: null })).toBe(ASK_MODE_PROMPT)
    expect(getAgentSystemPrompt({ mode: 'code', taskType: null })).toBeNull()
  })

  it('composes ask mode and the task-type prompt for typed ask-mode tasks', () => {
    const prompt = getAgentSystemPrompt({ mode: 'ask', taskType: 'code_review' })

    expect(prompt).toContain(ASK_MODE_PROMPT)
    expect(prompt).toContain('You are handling a **Code Review** task.')
  })

  it('prepends the task-type prompt for typed codex code-mode tasks', async () => {
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

    expect(requests[1]).toMatchObject({
      method: 'turn/start',
      params: {
        threadId: 'thread-tests',
      },
    })
    expect(requests[1].params.input[0].text).toContain('You are handling a **Write Tests** task.')
    expect(requests[1].params.input[0].text).toContain('Add regression coverage')
    expect(requests[1].params.input[0].text).not.toContain(ASK_MODE_PROMPT)
  })
})
