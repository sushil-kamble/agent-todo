let nextTaskSeq = 1
let nextRunSeq = 1

function isoDay() {
  return new Date().toISOString().slice(0, 10)
}

function isoNow() {
  return new Date().toISOString()
}

export function resetFactoryCounters() {
  nextTaskSeq = 1
  nextRunSeq = 1
}

export function taskFactory(overrides = {}) {
  const n = nextTaskSeq
  nextTaskSeq += 1
  return {
    id: overrides.id || `t-factory-${n}`,
    title: overrides.title || `Task ${n}`,
    project: overrides.project || `/tmp/project-${n}`,
    agent: overrides.agent || 'codex',
    tag: overrides.tag ?? null,
    column_id: overrides.column_id || 'todo',
    created_at: overrides.created_at || isoDay(),
  }
}

export function runFactory(taskId, overrides = {}) {
  const n = nextRunSeq
  nextRunSeq += 1
  return {
    id: overrides.id || `r-factory-${n}`,
    task_id: taskId,
    agent: overrides.agent || 'codex',
    thread_id: overrides.thread_id ?? null,
    status: overrides.status || 'starting',
    created_at: overrides.created_at || isoNow(),
  }
}
