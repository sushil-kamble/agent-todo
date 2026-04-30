import { afterEach, describe, expect, it, vi } from 'vitest'

const projects = [
  { id: 'p-a', path: '/repo/app', name: 'app', created_at: '2026-01-01' },
  { id: 'p-b', path: '/repo/app', name: 'app', created_at: '2026-01-02' },
  { id: 'p-c', path: '/repo/other', name: 'other', created_at: '2026-01-03' },
]

function jsonResponse(body) {
  return {
    json: async () => body,
  }
}

async function loadProjectApi() {
  vi.resetModules()
  return import('../src/features/project-picker/api')
}

describe('project picker api', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dedupes projects returned by the API before caching them', async () => {
    const fetch = vi.fn(async () => jsonResponse({ projects }))
    vi.stubGlobal('fetch', fetch)

    const { fetchProjects } = await loadProjectApi()

    await expect(fetchProjects()).resolves.toEqual([projects[0], projects[2]])
    await expect(fetchProjects()).resolves.toEqual([projects[0], projects[2]])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not post a project path that is already cached', async () => {
    const fetch = vi.fn(async () => jsonResponse({ projects }))
    vi.stubGlobal('fetch', fetch)

    const { addProject, fetchProjects } = await loadProjectApi()

    await fetchProjects()

    await expect(addProject('/repo/app')).resolves.toEqual(projects[0])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('coalesces duplicate in-flight project imports', async () => {
    const createdProject = projects[0]
    const fetch = vi.fn(async () => jsonResponse({ project: createdProject }))
    vi.stubGlobal('fetch', fetch)

    const { addProject } = await loadProjectApi()

    await expect(Promise.all([addProject('/repo/app'), addProject('/repo/app')])).resolves.toEqual([
      createdProject,
      createdProject,
    ])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not replace an unloaded project list with a single created project', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ project: projects[0] }))
      .mockResolvedValueOnce(jsonResponse({ projects: [projects[0], projects[2]] }))
    vi.stubGlobal('fetch', fetch)

    const { addProject, fetchProjects } = await loadProjectApi()

    await addProject('/repo/app')

    await expect(fetchProjects()).resolves.toEqual([projects[0], projects[2]])
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
