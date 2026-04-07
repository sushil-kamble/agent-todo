export type Agent = 'claude' | 'codex'
export type ColumnId = 'todo' | 'in_progress' | 'done'

export type TaskCard = {
  id: string
  title: string
  project: string
  agent: Agent
  createdAt: string
  tag?: string
}

export type Column = {
  id: ColumnId
  label: string
  hint: string
}

export const COLUMNS: Column[] = [
  { id: 'todo', label: 'Todo', hint: 'Queued for pickup' },
  { id: 'in_progress', label: 'In Progress', hint: 'Agent is working' },
  { id: 'done', label: 'Completed', hint: 'Shipped & verified' },
]

export const SEED: Record<ColumnId, TaskCard[]> = {
  todo: [
    {
      id: 't-1',
      title: 'Draft onboarding copy for the command palette',
      project: 'agent-todo/web',
      agent: 'claude',
      tag: 'copy',
      createdAt: '2026-04-08',
    },
    {
      id: 't-2',
      title: 'Wire up /health endpoint with dependency checks',
      project: 'orbit-api',
      agent: 'codex',
      tag: 'backend',
      createdAt: '2026-04-08',
    },
    {
      id: 't-3',
      title: 'Audit color tokens for WCAG AA contrast',
      project: 'design-system',
      agent: 'claude',
      tag: 'a11y',
      createdAt: '2026-04-07',
    },
  ],
  in_progress: [
    {
      id: 't-4',
      title: 'Refactor board store to use optimistic updates',
      project: 'agent-todo/web',
      agent: 'codex',
      tag: 'refactor',
      createdAt: '2026-04-06',
    },
    {
      id: 't-5',
      title: 'Write e2e flow for drag-and-drop reordering',
      project: 'agent-todo/web',
      agent: 'claude',
      tag: 'tests',
      createdAt: '2026-04-05',
    },
  ],
  done: [
    {
      id: 't-6',
      title: 'Set up Biome + strict TypeScript config',
      project: 'agent-todo/web',
      agent: 'codex',
      tag: 'tooling',
      createdAt: '2026-04-03',
    },
    {
      id: 't-7',
      title: 'Pick typography pair: Instrument Serif + JetBrains Mono',
      project: 'design-system',
      agent: 'claude',
      tag: 'design',
      createdAt: '2026-04-02',
    },
  ],
}
