import type {
  CreateProjectResponse,
  Project,
  ProjectListResponse,
} from '@agent-todo/shared/contracts/project'

export async function resolveDirectoryPath(path: string): Promise<string> {
  const response = await fetch('/api/paths/resolve-directory', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const body = (await response.json()) as { path: string }
  return body.path
}

let projectsCache: Project[] | null = null
let projectsRequest: Promise<Project[]> | null = null
const projectAddRequests = new Map<string, Promise<Project>>()

function dedupeProjects(projects: Project[]) {
  const seenPaths = new Set<string>()
  return projects.filter(project => {
    if (seenPaths.has(project.path)) return false
    seenPaths.add(project.path)
    return true
  })
}

function cacheProjects(projects: Project[]) {
  projectsCache = dedupeProjects(projects)
  return projectsCache
}

function mergeProject(projects: Project[] | null, project: Project) {
  const existingProjects = projects ?? []
  if (existingProjects.some(entry => entry.path === project.path)) {
    return dedupeProjects(
      existingProjects.map(entry => (entry.path === project.path ? project : entry))
    )
  }
  return dedupeProjects([...existingProjects, project])
}

export async function fetchProjects(): Promise<Project[]> {
  if (projectsCache) return projectsCache
  if (projectsRequest) return projectsRequest

  projectsRequest = fetch('/api/projects')
    .then(async response => {
      const body = (await response.json()) as ProjectListResponse
      return cacheProjects(body.projects)
    })
    .finally(() => {
      projectsRequest = null
    })

  return projectsRequest
}

export async function addProject(path: string): Promise<Project> {
  const projectPath = path.trim()
  const existing = projectsCache?.find(project => project.path === projectPath)
  if (existing) return existing

  const pending = projectAddRequests.get(projectPath)
  if (pending) return pending

  const request = fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: projectPath }),
  })
    .then(async response => {
      const body = (await response.json()) as CreateProjectResponse
      if (projectsCache) {
        projectsCache = mergeProject(projectsCache, body.project)
      }
      return body.project
    })
    .finally(() => {
      projectAddRequests.delete(projectPath)
    })

  projectAddRequests.set(projectPath, request)
  return request
}
