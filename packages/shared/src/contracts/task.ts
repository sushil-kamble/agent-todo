export type Agent = 'claude' | 'codex'
export type ColumnId = 'backlog' | 'todo' | 'in_progress' | 'done'
export type TaskMode = 'code' | 'ask'
export type EffortLevel = 'low' | 'medium' | 'high' | 'max' | 'xhigh'
export type TaskType =
  | 'feature_dev'
  | 'feature_plan'
  | 'code_review'
  | 'write_tests'
  | 'brainstorming'

export type TaskCard = {
  id: string
  title: string
  project: string
  agent: Agent
  createdAt: string
  runStatus?: string
  mode: TaskMode
  model: string | null
  effort: EffortLevel
  fastMode: boolean
  taskType: TaskType | null
}

export type ServerTask = {
  id: string
  title: string
  project: string
  agent: Agent
  column_id: ColumnId
  position: number
  created_at: string
  run_status: string | null
  mode: TaskMode
  model: string | null
  effort: EffortLevel
  fast_mode: boolean | number
  task_type: TaskType | null
}

export type CreateTaskRequest = {
  title: string
  project: string
  agent: Agent
  column_id: ColumnId
  mode?: TaskMode
  model?: string | null
  effort?: EffortLevel
  fastMode?: boolean
  taskType?: TaskType | null
}

export type PatchTaskRequest = Partial<{
  title: string
  project: string
  agent: Agent
  column_id: ColumnId
  position: number
  mode: TaskMode
  model: string | null
  effort: EffortLevel
  fastMode: boolean
  taskType: TaskType | null
}>

export type TaskListResponse = {
  tasks: ServerTask[]
}

export type TaskStatusesResponse = {
  statuses: Record<string, string | null>
}

export type CreateTaskResponse = {
  task: ServerTask
}

export type PatchTaskResponse = {
  task: ServerTask
  runId: string | null
}

export type TaskRunResponse = {
  run: import('./run').RunSummary | null
  messages: import('./run').RunMessage[]
}
