import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeRunEvents } from '../src/features/run-console/api'

class FakeEventSource {
  static instances = []

  constructor(url) {
    this.url = url
    this.onmessage = null
    this.onerror = null
    this.close = vi.fn()
    FakeEventSource.instances.push(this)
  }

  emit(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

describe('run console api', () => {
  afterEach(() => {
    FakeEventSource.instances = []
    vi.unstubAllGlobals()
  })

  it('closes the event stream after a terminal end event', () => {
    vi.stubGlobal('EventSource', FakeEventSource)

    const seen = []
    subscribeRunEvents('r-terminal', event => {
      seen.push(event)
    })

    const source = FakeEventSource.instances[0]
    source.emit({ type: 'message', seq: 1, role: 'user', kind: 'text', content: 'hello' })
    source.emit({ type: 'end', status: 'failed' })

    expect(seen).toEqual([
      { type: 'message', seq: 1, role: 'user', kind: 'text', content: 'hello' },
      { type: 'end', status: 'failed' },
    ])
    expect(source.close).toHaveBeenCalledTimes(1)
  })

  it('returns an unsubscribe function that closes the event stream', () => {
    vi.stubGlobal('EventSource', FakeEventSource)

    const unsubscribe = subscribeRunEvents('r-unsubscribe', () => {})
    const source = FakeEventSource.instances[0]

    unsubscribe()

    expect(source.close).toHaveBeenCalledTimes(1)
  })
})
