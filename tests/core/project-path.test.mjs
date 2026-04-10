import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  __resetProjectPathCacheForTests,
  normalizeProjectPath,
} from '../../server/lib/project-path.mjs'

describe('normalizeProjectPath', () => {
  let originalCwd
  let root
  let workspace

  beforeEach(() => {
    originalCwd = process.cwd()
    root = mkdtempSync(join(tmpdir(), 'agent-path-'))
    workspace = join(root, 'workspace')

    mkdirSync(workspace, { recursive: true })
    mkdirSync(join(workspace, 'direct-project'), { recursive: true })
    mkdirSync(join(workspace, 'apps', 'deep', 'named-project'), {
      recursive: true,
    })

    process.chdir(workspace)
    __resetProjectPathCacheForTests()
  })

  afterEach(() => {
    __resetProjectPathCacheForTests()
    process.chdir(originalCwd)
    rmSync(root, { recursive: true, force: true })
  })

  it('preserves and normalizes absolute paths', async () => {
    const input = join(workspace, 'direct-project', '..')
    const resolvedPath = await normalizeProjectPath(input)

    expect(resolvedPath).toBe(resolve(input))
  })

  it('resolves direct relative names under expected roots', async () => {
    const resolvedPath = await normalizeProjectPath('direct-project')

    expect(resolvedPath).toContain('/workspace/direct-project')
  })

  it('resolves nested project names within depth limit', async () => {
    const resolvedPath = await normalizeProjectPath('named-project')

    expect(resolvedPath).toContain('/workspace/apps/deep/named-project')
  })

  it('falls back to original input for unknown names', async () => {
    const unknown = `missing-${randomUUID().slice(0, 8)}`
    const resolvedPath = await normalizeProjectPath(unknown)

    expect(resolvedPath).toBe(unknown)
  })
})
