export type Project = {
  id: string
  path: string
  name: string
  created_at: string
}

export type ProjectListResponse = {
  projects: Project[]
}

export type CreateProjectRequest = {
  path: string
}

export type CreateProjectResponse = {
  project: Project
}
