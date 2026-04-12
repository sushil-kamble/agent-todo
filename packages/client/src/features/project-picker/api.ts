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

export async function fetchProjects(): Promise<Project[]> {
  const response = await fetch('/api/projects')
  const body = (await response.json()) as ProjectListResponse
  return body.projects
}

export async function addProject(path: string): Promise<Project> {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  const body = (await response.json()) as CreateProjectResponse
  return body.project
}
