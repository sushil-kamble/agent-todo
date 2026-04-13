import type { Project } from '@agent-todo/shared/contracts/project'
import type {
  AgentSubscription,
  AgentUsageSnapshot,
  Subscriptions,
} from '@agent-todo/shared/contracts/subscription'
import {
  ArchiveIcon,
  CaretDownIcon,
  CodeIcon,
  FloppyDiskIcon,
  FolderOpenIcon,
  InfoIcon,
  MagnifyingGlassIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import type {
  Agent,
  ColumnId,
  EffortLevel,
  TaskCard,
  TaskMode,
  TaskType,
} from '#/entities/task/types'
import { fetchSubscriptions } from '#/features/agent-config/api'
import {
  getEffortOptions,
  getModelConfig,
  getModelLabel,
  MODELS_BY_AGENT,
  modelSupportsFastMode,
  sanitizeEffort,
  sanitizeFastMode,
  sanitizeModel,
} from '#/features/agent-config/model/model-config'
import {
  DEFAULT_PROJECTLESS_MODE,
  DEFAULT_TASK_MODE,
  modeRequiresProject,
  TASK_MODE_OPTIONS,
} from '#/features/agent-config/model/task-config'
import {
  getTaskTypeAllowedModes,
  getTaskTypeLabel,
  getTaskTypeRecommendation,
  TASK_TYPE_EMPTY_SELECTION_HINT,
  TASK_TYPE_OPTIONS,
  taskTypeRequiresProject,
} from '#/features/agent-config/model/task-type-config'
import { addProject, fetchProjects, resolveDirectoryPath } from '#/features/project-picker/api'
import { PanelHeader } from '#/features/run-console/components/shared'
import { formatProjectPathLabel } from '#/shared/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '#/shared/ui/alert-dialog'
import { Button } from '#/shared/ui/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '#/shared/ui/combobox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '#/shared/ui/dropdown-menu'
import { ClaudeIcon, OpenAIIcon } from '#/shared/ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/shared/ui/tooltip'
import { readStoredTaskConfig, writeStoredTaskConfig } from '../model/default-config-storage'

type StoredConfigShape = ReturnType<typeof readStoredTaskConfig>
type ProjectComboboxItem = {
  value: string
  label: string
  path: string
}

type TaskCreationValidationInput = {
  title: string
  project: string
  projectOptions: string[]
  agent: Agent
  mode: string
  taskType: TaskType | null
  model: string | null
  effort: string
  subs: Subscriptions | null
}

export function resolveInitialFormState(
  editingTask: TaskCard | null,
  storedConfig: StoredConfigShape
) {
  const agent = editingTask ? editingTask.agent : storedConfig.agent
  const mode = editingTask ? editingTask.mode : storedConfig.mode
  const model = sanitizeModel(agent, editingTask ? editingTask.model : storedConfig.model)
  const effort = editingTask
    ? sanitizeEffort(agent, model, editingTask.effort)
    : storedConfig.effort
  const fastMode = editingTask
    ? sanitizeFastMode(agent, model, editingTask.fastMode)
    : sanitizeFastMode(agent, model, storedConfig.fastMode)
  const taskType = editingTask?.taskType ?? null

  return { agent, mode, model, effort, fastMode, taskType }
}

export function resolveTaskCreationValidation({
  title,
  project,
  projectOptions,
  agent,
  mode,
  taskType,
  model,
  effort,
  subs,
}: TaskCreationValidationInput) {
  const missing: string[] = []
  const normalizedTitle = title.trim()
  const normalizedProject = project.trim()

  if (!normalizedTitle) {
    missing.push('Task prompt')
  }

  const needsProject =
    (taskType ? taskTypeRequiresProject(taskType) : false) || modeRequiresProject(mode as TaskMode)
  if (needsProject && (!normalizedProject || !projectOptions.includes(normalizedProject))) {
    missing.push('Project selection')
  }

  if (subs && !subs[agent]?.available) {
    missing.push('Assigned to')
  }

  const hasValidMode = TASK_MODE_OPTIONS.some(option => option.value === mode)
  let hasValidConfiguration = hasValidMode
  if (hasValidConfiguration) {
    try {
      hasValidConfiguration = getEffortOptions(agent, model).some(option => option.value === effort)
    } catch {
      hasValidConfiguration = false
    }
  }
  if (!hasValidConfiguration) {
    missing.push('Configuration')
  }

  return {
    missing,
    disabled: missing.length > 0,
  }
}

function getCreateTaskTooltipCopy(missing: string[]) {
  if (missing.length === 0) return null
  if (missing.length === 1) return `${missing[0]} is required before creating a task.`
  return `${missing.join(', ')} are required before creating a task.`
}

export function resolveAgentSelectionAfterSubscriptions(
  currentAgent: Agent,
  subs: Subscriptions | null
) {
  if (!subs || subs[currentAgent]?.available) return currentAgent
  const otherAgent: Agent = currentAgent === 'claude' ? 'codex' : 'claude'
  return subs[otherAgent]?.available ? otherAgent : currentAgent
}

export function resolveAvailableTaskModes({
  taskType,
  hasProject,
}: {
  taskType: TaskType | null
  hasProject: boolean
}) {
  let options = TASK_MODE_OPTIONS

  if (taskType) {
    const allowedModes = getTaskTypeAllowedModes(taskType)
    options = options.filter(option => allowedModes.includes(option.value))
  }

  const requiresProject = taskType ? taskTypeRequiresProject(taskType) : false
  if (!hasProject && !requiresProject) {
    options = options.filter(option => !option.requiresProject)
  }

  return options
}

export function resolveAvailableTaskTypes({ hasProject }: { hasProject: boolean }) {
  return hasProject
    ? TASK_TYPE_OPTIONS
    : TASK_TYPE_OPTIONS.filter(option => option.requiresProject !== true)
}

export function resolveConstrainedTaskMode({
  currentMode,
  taskType,
  hasProject,
  fallbackMode = DEFAULT_TASK_MODE,
}: {
  currentMode: TaskMode
  taskType: TaskType | null
  hasProject: boolean
  fallbackMode?: TaskMode
}) {
  const availableModes = resolveAvailableTaskModes({ taskType, hasProject })

  if (availableModes.some(option => option.value === currentMode)) {
    return currentMode
  }

  if (availableModes.some(option => option.value === fallbackMode)) {
    return fallbackMode
  }

  return availableModes[0]?.value ?? DEFAULT_PROJECTLESS_MODE
}

export function resolveModelSelectionState({
  agent,
  selectedModelSlug,
  preferredEffort,
  preferredFastMode,
}: {
  agent: Agent
  selectedModelSlug: string
  preferredEffort: EffortLevel
  preferredFastMode: boolean
}) {
  const defaultModelSlug = MODELS_BY_AGENT[agent].find(model => model.isDefault)?.slug ?? null

  return {
    model: selectedModelSlug === defaultModelSlug ? null : selectedModelSlug,
    effort: sanitizeEffort(agent, selectedModelSlug, preferredEffort),
    fastMode: sanitizeFastMode(agent, selectedModelSlug, preferredFastMode),
  }
}

export function FormPanel({
  isEdit,
  createColumn,
  editingTask,
  editingColumn,
  close,
  onCreate,
  onUpdate,
  onDelete,
  onMoveToBacklog,
}: {
  isEdit: boolean
  createColumn: ColumnId
  editingTask: TaskCard | null
  editingColumn: ColumnId | null
  close: () => void
  onCreate: (input: {
    title: string
    project: string
    agent: Agent
    column: ColumnId
    mode: TaskMode
    model: string | null
    effort: EffortLevel
    fastMode: boolean
    taskType: TaskType | null
  }) => void
  onUpdate: (
    id: string,
    updates: {
      title: string
      project: string
      agent: Agent
      mode: TaskMode
      model: string | null
      effort: EffortLevel
      fastMode: boolean
      taskType: TaskType | null
    },
    fromColumn: ColumnId,
    toColumn: ColumnId
  ) => void
  onDelete?: (id: string) => void
  onMoveToBacklog?: (
    id: string,
    updates: {
      title: string
      project: string
      agent: Agent
      mode: TaskMode
      model: string | null
      effort: EffortLevel
      fastMode: boolean
      taskType: TaskType | null
    }
  ) => void
}) {
  const storedConfigRef = useRef(readStoredTaskConfig())
  const storedConfig = storedConfigRef.current
  const initialState = resolveInitialFormState(editingTask, storedConfig)
  const [projects, setProjects] = useState<Project[]>([])
  const projectOptions = projects.map(projectEntry => projectEntry.path)
  const projectItems: ProjectComboboxItem[] = projectOptions.map(path => ({
    value: path,
    label: formatProjectPathLabel(path),
    path,
  }))

  useEffect(() => {
    fetchProjects().then(setProjects)
  }, [])

  const [title, setTitle] = useState(editingTask?.title ?? '')
  const [project, setProject] = useState(
    editingTask?.project === 'untitled' ? '' : (editingTask?.project ?? '')
  )
  const [agent, setAgent] = useState<Agent>(initialState.agent)
  const [mode, setMode] = useState<TaskMode>(initialState.mode)
  const [model, setModel] = useState<string | null>(initialState.model)
  const [effort, setEffort] = useState<EffortLevel>(initialState.effort)
  const [fastMode, setFastMode] = useState<boolean>(initialState.fastMode)
  const [taskType, setTaskType] = useState<TaskType | null>(initialState.taskType)
  const [subs, setSubs] = useState<Subscriptions | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const projectInputRef = useRef<HTMLInputElement>(null)
  const selectedProjectItem = projectItems.find(item => item.value === project) ?? null
  const hasProject = project.trim() !== '' && projectOptions.includes(project.trim())
  const isProjectLocked = isEdit && (editingColumn === 'in_progress' || editingColumn === 'done')
  const createTaskValidation = resolveTaskCreationValidation({
    title,
    project,
    projectOptions,
    agent,
    mode,
    taskType,
    model,
    effort,
    subs,
  })
  const createTaskTooltip = getCreateTaskTooltipCopy(createTaskValidation.missing)
  const isSubmitDisabled = createTaskValidation.disabled

  useEffect(() => {
    fetchSubscriptions().then(setSubs)
  }, [])

  // Auto-select the first available agent when subscription data arrives
  useEffect(() => {
    if (!subs) return
    const nextAgent = resolveAgentSelectionAfterSubscriptions(agent, subs)
    if (nextAgent !== agent) {
      setAgent(nextAgent)
      setModel(null)
    }
  }, [subs, agent])

  useEffect(() => {
    setEffort(current => sanitizeEffort(agent, model, current))
    setFastMode(current => sanitizeFastMode(agent, model, current))
  }, [agent, model])

  useEffect(() => {
    if (!hasProject && taskType && taskTypeRequiresProject(taskType)) {
      setTaskType(null)
    }
  }, [hasProject, taskType])

  useEffect(() => {
    const nextMode = resolveConstrainedTaskMode({
      currentMode: mode,
      taskType,
      hasProject,
    })
    if (nextMode !== mode) {
      setMode(nextMode)
    }
  }, [hasProject, mode, taskType])

  function handleAgentChange(next: Agent) {
    setAgent(next)
    // Reset model when switching agents — models are agent-specific
    setModel(null)
  }

  useEffect(() => {
    requestAnimationFrame(() => {
      const el = titleRef.current
      if (!el) return
      el.focus()
      if (isEdit) {
        el.setSelectionRange(el.value.length, el.value.length)
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    })
  }, [isEdit])

  async function pickFolder() {
    try {
      const handle = await (
        window as Window & {
          showDirectoryPicker?: () => Promise<{ name: string }>
        }
      ).showDirectoryPicker?.()
      if (!handle) return
      const resolved = await resolveDirectoryPath(handle.name)
      setProject(resolved)
      // Register in DB and refresh the projects list
      await addProject(resolved)
      fetchProjects().then(setProjects)
    } catch {
      // user cancelled
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const finalProject = (selectedProjectItem?.value ?? project).trim()
    if (!title.trim()) {
      titleRef.current?.focus()
      return
    }
    if (!isEdit && createTaskValidation.disabled) {
      if (modeRequiresProject(mode) && !projectOptions.includes(finalProject)) {
        projectInputRef.current?.focus()
      }
      return
    }
    writeStoredTaskConfig({ agent, mode, model, effort, fastMode })
    if (isEdit && createTaskValidation.disabled) {
      if (
        ((taskType ? taskTypeRequiresProject(taskType) : false) || modeRequiresProject(mode)) &&
        !projectOptions.includes(finalProject)
      ) {
        projectInputRef.current?.focus()
      }
      return
    }
    if (isEdit && editingTask && editingColumn) {
      onUpdate(
        editingTask.id,
        { title, project: finalProject, agent, mode, model, effort, fastMode, taskType },
        editingColumn,
        editingColumn
      )
      return
    }
    onCreate({
      title,
      project: finalProject,
      agent,
      column: createColumn,
      mode,
      model,
      effort,
      fastMode,
      taskType,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="animate-in fade-in zoom-in-95 slide-in-from-bottom-4 relative z-10 flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden border border-foreground bg-background shadow-[8px_8px_0_0_oklch(0.18_0.012_80/0.18)] duration-200 ease-out sm:max-h-[calc(100vh-3rem)]"
    >
      <PanelHeader label={title.trim() || (isEdit ? 'Edit task' : 'New task')} onClose={close} />

      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <div>
          <label
            htmlFor="task-title"
            className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase"
          >
            Task
          </label>
          <textarea
            id="task-title"
            ref={titleRef}
            value={title}
            rows={3}
            onChange={e => {
              setTitle(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                e.currentTarget.form?.requestSubmit()
              }
            }}
            placeholder="Describe exactly what needs to be done…"
            className="font-heading w-full resize-none overflow-hidden border-b border-border bg-transparent pb-2 text-base leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <label htmlFor="task-project">Project</label>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Project field guidance"
                    />
                  }
                >
                  <InfoIcon size={12} weight="bold" />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <p className="max-w-56 text-xs">
                    Choose the local project directory the agent should use as working context.
                    Leave it blank only for task types that support project-less work.
                  </p>
                </TooltipContent>
              </Tooltip>
            </span>
            <div className="flex items-stretch gap-0">
              <Combobox
                items={projectItems}
                itemToStringLabel={item => item.label}
                itemToStringValue={item => item.value}
                isItemEqualToValue={(item, value) => item.value === value.value}
                value={selectedProjectItem}
                onValueChange={val => !isProjectLocked && setProject(val?.value ?? '')}
                onInputValueChange={(inputVal, eventDetails) => {
                  if (isProjectLocked) return
                  if (
                    eventDetails.reason === 'input-change' ||
                    eventDetails.reason === 'input-clear'
                  ) {
                    setProject(inputVal)
                  }
                }}
              >
                <ComboboxInput
                  ref={projectInputRef}
                  id="task-project"
                  placeholder={
                    isProjectLocked
                      ? 'Project cannot be changed here'
                      : 'Select or type a path… (optional)'
                  }
                  className="h-9 flex-1 [&_input]:text-xs"
                  disabled={isProjectLocked}
                />
                {!isProjectLocked && (
                  <ComboboxContent>
                    <ComboboxEmpty>No matching projects</ComboboxEmpty>
                    <ComboboxList>
                      {item => (
                        <ComboboxItem key={item.value} value={item} className="items-start">
                          <FolderOpenIcon
                            size={13}
                            className="mt-0.5 shrink-0 text-muted-foreground"
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="truncate font-medium">{item.label}</span>
                            <span className="truncate text-[0.65rem] text-muted-foreground">
                              {item.path}
                            </span>
                          </span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                )}
              </Combobox>
              <button
                type="button"
                title="Browse folder"
                onClick={pickFolder}
                disabled={isProjectLocked}
                className={[
                  'h-9 flex items-center border border-l-0 border-input bg-transparent px-2.5 text-muted-foreground transition-colors',
                  isProjectLocked
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-accent hover:text-foreground',
                ].join(' ')}
              >
                <FolderOpenIcon size={13} />
              </button>
            </div>
          </div>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <span>Task type</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Task type guidance"
                    />
                  }
                >
                  <InfoIcon size={12} weight="bold" />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <p className="max-w-56 text-xs">{TASK_TYPE_EMPTY_SELECTION_HINT}</p>
                </TooltipContent>
              </Tooltip>
            </span>
            <TaskTypePicker value={taskType} onChange={setTaskType} hasProject={hasProject} />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Assign to
          </span>
          <div className="grid grid-cols-2 gap-2">
            <AgentChoice
              value="claude"
              current={agent}
              onSelect={handleAgentChange}
              label="Claude"
              disabled={subs !== null && !subs.claude.available}
              plan={subs?.claude.plan ?? undefined}
              reason={subs?.claude.reason ?? undefined}
              usage={subs?.claude.usage ?? null}
            />
            <AgentChoice
              value="codex"
              current={agent}
              onSelect={handleAgentChange}
              label="Codex"
              disabled={subs !== null && !subs.codex.available}
              plan={subs?.codex.plan ?? undefined}
              reason={subs?.codex.reason ?? undefined}
              usage={subs?.codex.usage ?? null}
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[0.6rem] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Configuration
          </span>
          <div className="grid grid-cols-2 gap-2">
            <ModePicker
              value={mode}
              onChange={setMode}
              hasProject={hasProject}
              taskType={taskType}
            />
            <ModelEffortPicker
              agent={agent}
              model={model}
              effort={effort}
              fastMode={fastMode}
              taskType={taskType}
              onModelChange={setModel}
              onEffortChange={setEffort}
              onFastModeChange={setFastMode}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <div className="flex items-center gap-2">
          {isEdit &&
          ['backlog', 'todo'].includes(editingColumn ?? '') &&
          onDelete &&
          editingTask ? (
            <AlertDialog>
              <AlertDialogTrigger render={<Button type="button" variant="destructive" size="sm" />}>
                <TrashIcon size={14} />
                <span className="text-[0.68rem] tracking-[0.12em] uppercase">Delete</span>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the task and all its run history. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel size="sm">Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(editingTask.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
          {isEdit && editingColumn === 'todo' && onMoveToBacklog && editingTask ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onMoveToBacklog(editingTask.id, {
                  title,
                  project: (projectInputRef.current?.value ?? project).trim(),
                  agent,
                  mode,
                  model,
                  effort,
                  fastMode,
                  taskType,
                })
              }
            >
              <ArchiveIcon size={14} />
              <span className="text-[0.68rem] tracking-[0.12em] uppercase">Move to backlog</span>
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!createTaskTooltip ? (
            <Button type="submit" size="sm" disabled={isSubmitDisabled}>
              {isEdit ? <FloppyDiskIcon size={14} /> : null}
              <span className="text-[0.68rem] tracking-[0.12em] uppercase">
                {isEdit ? 'Save changes' : 'Create task'}
              </span>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex" />}>
                <Button type="submit" size="sm" disabled={isSubmitDisabled}>
                  <span className="text-[0.68rem] tracking-[0.12em] uppercase">Create task</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <p className="max-w-56 text-xs">{createTaskTooltip}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </form>
  )
}

function ModePicker({
  value,
  onChange,
  hasProject,
  taskType,
}: {
  value: TaskMode
  onChange: (m: TaskMode) => void
  hasProject: boolean
  taskType: TaskType | null
}) {
  const availableModes = resolveAvailableTaskModes({ taskType, hasProject })
  const currentMode =
    TASK_MODE_OPTIONS.find(option => option.value === value) ?? TASK_MODE_OPTIONS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-foreground focus:border-foreground focus:outline-none">
        <span className="flex items-center gap-2">
          {currentMode?.value === 'code' ? (
            <CodeIcon size={14} weight="bold" />
          ) : (
            <MagnifyingGlassIcon size={14} weight="bold" />
          )}
          <span className="font-medium">{currentMode?.label ?? value}</span>
        </span>
        <CaretDownIcon size={12} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>Mode</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as TaskMode)}>
            {availableModes.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[0.65rem] text-muted-foreground">{option.description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskTypePicker({
  value,
  onChange,
  hasProject,
}: {
  value: TaskType | null
  onChange: (value: TaskType | null) => void
  hasProject: boolean
}) {
  const availableTaskTypes = resolveAvailableTaskTypes({ hasProject })
  const summaryLabel = value ? getTaskTypeLabel(value) : 'Select a task type… (optional)'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-2 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-foreground focus:border-foreground focus:outline-none">
        <span className={value ? 'font-medium' : 'text-muted-foreground'}>{summaryLabel}</span>
        <CaretDownIcon size={12} className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Task type</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={value ?? '__none__'}
            onValueChange={nextValue =>
              onChange(nextValue === '__none__' ? null : (nextValue as TaskType))
            }
          >
            <DropdownMenuRadioItem value="__none__">
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Leave blank</span>
                <span className="text-[0.65rem] text-muted-foreground">
                  No task-type prompt or recommendations
                </span>
              </span>
            </DropdownMenuRadioItem>
            {availableTaskTypes.map(option => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">{option.label}</span>
                  <span className="text-[0.65rem] text-muted-foreground">{option.description}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function describeMenuHints(hints: string[]) {
  return hints.length > 0 ? ` (${hints.join(', ')})` : ''
}

function ModelEffortPicker({
  agent,
  model,
  effort,
  fastMode,
  taskType,
  onModelChange,
  onEffortChange,
  onFastModeChange,
}: {
  agent: Agent
  model: string | null
  effort: EffortLevel
  fastMode: boolean
  taskType: TaskType | null
  onModelChange: (m: string | null) => void
  onEffortChange: (e: EffortLevel) => void
  onFastModeChange: (value: boolean) => void
}) {
  const models = MODELS_BY_AGENT[agent]
  const currentModelSlug = getModelConfig(agent, model).slug
  const recommendedSelection = taskType ? getTaskTypeRecommendation(taskType, agent) : null
  const summaryLabel = `${getModelLabel(agent, model)} (${effort}${fastMode ? ', fast' : ''})`

  function selectModelAndConfig(
    modelSlug: string,
    effortLevel: EffortLevel,
    nextFastMode: boolean
  ) {
    const nextState = resolveModelSelectionState({
      agent,
      selectedModelSlug: modelSlug,
      preferredEffort: effortLevel,
      preferredFastMode: nextFastMode,
    })
    onModelChange(nextState.model)
    onEffortChange(nextState.effort)
    onFastModeChange(nextState.fastMode)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 w-full items-center justify-between gap-1 border border-border bg-card px-3 text-xs text-foreground transition-colors hover:border-foreground focus:border-foreground focus:outline-none">
        <span className="min-w-0 truncate font-medium">{summaryLabel}</span>
        <CaretDownIcon size={12} className="shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={4} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          {models.map(m => {
            const isActiveModel = m.slug === currentModelSlug
            const isRecommendedModel = recommendedSelection?.model === m.slug
            const effortOptions = getEffortOptions(agent, m.slug)
            return (
              <DropdownMenuSub key={m.slug}>
                <DropdownMenuSubTrigger className={isActiveModel ? 'font-semibold' : ''}>
                  {m.label}
                  {describeMenuHints([
                    ...(m.isDefault ? ['default'] : []),
                    ...(isRecommendedModel ? ['Recommended'] : []),
                  ])}
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Thinking Effort</DropdownMenuLabel>
                      {effortOptions.map(e => {
                        const isActive = isActiveModel && e.value === effort
                        const isRecommendedEffort =
                          isRecommendedModel && recommendedSelection?.effort === e.value
                        return (
                          <DropdownMenuItem
                            key={e.value}
                            onClick={() =>
                              selectModelAndConfig(
                                m.slug,
                                e.value,
                                isActiveModel ? fastMode : false
                              )
                            }
                            className={isActive ? 'bg-foreground/10' : ''}
                          >
                            <span className="flex flex-col gap-0.5">
                              <span className="font-medium">
                                {e.label}
                                {describeMenuHints([
                                  ...(e.isDefault ? ['default'] : []),
                                  ...(isRecommendedEffort ? ['Recommended'] : []),
                                ])}
                                {isActive ? ' ✓' : ''}
                              </span>
                              <span className="text-[0.65rem] text-muted-foreground">
                                {e.description}
                              </span>
                            </span>
                          </DropdownMenuItem>
                        )
                      })}
                    </DropdownMenuGroup>
                    {modelSupportsFastMode(agent, m.slug) && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Fast mode</DropdownMenuLabel>
                          <DropdownMenuRadioGroup
                            value={isActiveModel && fastMode ? 'on' : 'off'}
                            onValueChange={value =>
                              selectModelAndConfig(m.slug, effort, value === 'on')
                            }
                          >
                            <DropdownMenuRadioItem value="off">
                              <span className="flex flex-col gap-0.5">
                                <span className="font-medium">Off (default)</span>
                                <span className="text-[0.65rem] text-muted-foreground">
                                  Standard speed and credit usage
                                </span>
                              </span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="on">
                              <span className="flex flex-col gap-0.5">
                                <span className="font-medium">On</span>
                                <span className="text-[0.65rem] text-muted-foreground">
                                  Faster responses with higher credit usage
                                </span>
                              </span>
                            </DropdownMenuRadioItem>
                          </DropdownMenuRadioGroup>
                        </DropdownMenuGroup>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function planLabel(plan: string): string {
  const labels: Record<string, string> = {
    pro: 'Pro',
    max: 'Max',
    plus: 'Plus',
    free: 'Free',
    team: 'Team',
    business: 'Business',
    enterprise: 'Enterprise',
    edu: 'Edu',
    education: 'Education',
    go: 'Go',
  }
  const base = plan.split('_')[0]
  const suffix = plan.includes('_') ? ` ${plan.split('_')[1]}` : ''
  return (labels[base] ?? plan) + suffix
}

function formatResetAt(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatCreditsRemaining(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)
}

function buildUsageSummary(usage?: AgentUsageSnapshot | null): string[] {
  if (!usage) return []

  const details: Array<string | null> = [
    typeof usage.fiveHourUtilization === 'number'
      ? `5h limit: ${Math.max(0, 100 - Math.round(usage.fiveHourUtilization))}% left${
          formatResetAt(usage.fiveHourResetsAt)
            ? `, resets ${formatResetAt(usage.fiveHourResetsAt)}`
            : ''
        }`
      : null,
    typeof usage.sevenDayUtilization === 'number'
      ? `Weekly limit: ${Math.max(0, 100 - Math.round(usage.sevenDayUtilization))}% left${
          formatResetAt(usage.sevenDayResetsAt)
            ? `, resets ${formatResetAt(usage.sevenDayResetsAt)}`
            : ''
        }`
      : null,
    usage.creditsUnlimited === true
      ? 'Credits: unlimited'
      : typeof usage.creditsRemaining === 'number' && usage.creditsRemaining > 0
        ? `Credits: ${formatCreditsRemaining(usage.creditsRemaining)} remaining`
        : null,
  ]

  return details.filter((detail): detail is string => Boolean(detail))
}

export function getAgentTooltipCopy({
  agent,
  label,
  plan,
  reason,
  usage,
}: {
  agent: Agent
  label: string
  plan?: string | null
  reason?: AgentSubscription['reason']
  usage?: AgentUsageSnapshot | null
}) {
  const usageSummary = buildUsageSummary(usage)
  const resolvedPlan = plan ? planLabel(plan) : null

  if (reason === 'not_installed') {
    return {
      title: `${label} unavailable`,
      body:
        agent === 'claude'
          ? 'Claude Code is not installed or not available on PATH for this app.'
          : 'Codex is not installed or not available on PATH for this app.',
    }
  }

  if (reason === 'login_required') {
    return {
      title: `${label} needs sign-in`,
      body:
        agent === 'claude'
          ? 'Claude Code is installed, but no active Claude login was found.'
          : 'Codex is installed, but no active ChatGPT login was found.',
    }
  }

  if (reason === 'api_key_auth') {
    return {
      title: `${label} using API key`,
      body: 'ChatGPT plan and ChatGPT usage limits are unavailable when Codex is authenticated with an API key.',
    }
  }

  if (reason === 'usage_exhausted') {
    return {
      title: `${label} limits exhausted`,
      body:
        usageSummary.length > 0
          ? `No remaining included capacity is available right now. ${usageSummary.join('. ')}.`
          : 'No remaining included capacity is available right now.',
    }
  }

  if (resolvedPlan || usageSummary.length > 0) {
    const bodyParts = [
      resolvedPlan
        ? `Subscribed plan: ${resolvedPlan}`
        : agent === 'claude'
          ? 'No Claude subscription plan was detected'
          : 'No ChatGPT subscription plan was detected',
      ...usageSummary,
    ]

    return {
      title: resolvedPlan ? `${label} ${resolvedPlan}` : `${label} status`,
      body: `${bodyParts.join('. ')}.`,
    }
  }

  if (reason === 'usage_unverified') {
    return {
      title: `${label} available`,
      body: 'The agent is installed and authenticated, but live limit data could not be verified yet.',
    }
  }

  return {
    title: `${label} available`,
    body:
      agent === 'claude'
        ? 'Claude Code is available, but no live subscription details were detected.'
        : 'Codex is available, but no live ChatGPT plan details were detected.',
  }
}

function AgentChoice({
  value,
  current,
  onSelect,
  label,
  disabled,
  plan,
  reason,
  usage,
}: {
  value: Agent
  current: Agent
  onSelect: (a: Agent) => void
  label: string
  disabled?: boolean
  plan?: string
  reason?: string | null
  usage?: AgentUsageSnapshot | null
}) {
  const active = current === value
  const Icon = value === 'claude' ? ClaudeIcon : OpenAIIcon
  const tooltipCopy = getAgentTooltipCopy({
    agent: value,
    label,
    plan,
    reason,
    usage,
  })

  const buttonElem = (
    <button
      type="button"
      onClick={() => !disabled && onSelect(value)}
      aria-pressed={active}
      disabled={disabled}
      className={[
        'flex w-full items-center gap-2 border px-3 py-2 text-left transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-card text-muted-foreground/40'
          : active
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-card text-foreground hover:border-foreground',
      ].join(' ')}
    >
      <span
        className={[
          'flex size-6 items-center justify-center border',
          disabled
            ? 'border-border/50 bg-background text-muted-foreground/40'
            : active
              ? 'border-background bg-background text-foreground'
              : 'border-border bg-background text-foreground',
        ].join(' ')}
      >
        <Icon size={12} />
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[0.78rem] font-medium leading-tight">{label}</span>
        {disabled && (
          <span className="text-[0.6rem] leading-none text-muted-foreground/60">Unavailable</span>
        )}
        {!disabled && plan && (
          <span
            className={[
              'text-[0.6rem] leading-none',
              active ? 'text-current opacity-60' : 'text-muted-foreground',
            ].join(' ')}
          >
            {planLabel(plan)}
          </span>
        )}
      </span>
    </button>
  )

  if (!tooltipCopy) return buttonElem

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex w-full" />}>{buttonElem}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <div className="flex max-w-64 flex-col gap-1">
          <p className="font-medium">{tooltipCopy.title}</p>
          <p className="text-xs text-background/80">{tooltipCopy.body}</p>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
