import { describe, expect, it } from 'vitest'
import { dedupeProjectsByPath } from '#domains/projects/project-utils.mjs'

describe('project repository helpers', () => {
  it('keeps only the first project for each path', () => {
    const projects = [
      { id: 'p-a', path: '/repo/app', name: 'app', created_at: '2026-01-01' },
      { id: 'p-b', path: '/repo/app', name: 'app', created_at: '2026-01-02' },
      { id: 'p-c', path: '/repo/other', name: 'other', created_at: '2026-01-03' },
    ]

    expect(dedupeProjectsByPath(projects)).toEqual([projects[0], projects[2]])
  })
})
