import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer } from '../helpers/start-test-server.mjs'
import { bootstrapTestDatabase } from '../helpers/test-db.mjs'

describe('project routes integration', () => {
  let harness
  let server

  beforeAll(() => {
    harness = bootstrapTestDatabase('project-routes')
  })

  beforeEach(async () => {
    harness.reset()
    server = await startTestServer()
  })

  afterEach(async () => {
    await server.close()
  })

  afterAll(() => {
    harness.cleanup()
  })

  it('returns the existing project when the same path is imported again', async () => {
    const projectPath = join(harness.root, 'workspace')
    const equivalentPath = join(projectPath, '..', 'workspace')

    const first = await server.json('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: projectPath }),
    })
    const second = await server.json('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: equivalentPath }),
    })
    const list = await server.json('/api/projects')

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(second.body.project).toEqual(first.body.project)
    expect(
      list.body.projects.filter(project => project.path === first.body.project.path)
    ).toHaveLength(1)
  })
})
