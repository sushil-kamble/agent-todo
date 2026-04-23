import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useEffect, useMemo, useState } from 'react'
import { COLUMNS, type ColumnId, type TaskCard } from '#/entities/task/types'
import { useBoardSearch, useBoardTasks } from '#/features/task-board/model'
import {
  findTaskColumn,
  getAllowedDropColumns,
  insertTaskAtDropLocation,
  reorderTasksInColumn,
  resolveDropLocation,
} from '#/features/task-board/model/drag-utils'
import {
  getMainBoardContentState,
  getRemainingBoardLoaderMs,
  type MainBoardContentState,
} from '#/features/task-board/model/empty-state'
import { BacklogPanel } from './BacklogPanel'
import { BoardEmptyState } from './BoardEmptyState'
import { BoardLoadingState } from './BoardLoadingState'
import { BoardColumn } from './Column'
import { TaskCardView } from './TaskCardView'

type BoardProps = {
  backlogOpen: boolean
  onBacklogOpenChange: (open: boolean) => void
}

const BACKLOG_PANEL_WIDTH_PX = 384
const BOARD_REVEAL_FADE_MS = 320

function renderBoardColumns({
  columns,
  dragOrigin,
  dragTarget,
  filteredTasks,
}: {
  columns: typeof COLUMNS
  dragOrigin: ColumnId | null
  dragTarget: ColumnId | null
  filteredTasks: Record<ColumnId, TaskCard[]>
}) {
  return (
    <div className="grid h-full min-h-0 flex-1 grid-cols-3 items-stretch gap-5">
      {columns.map((column, index) => (
        <BoardColumn
          key={column.id}
          column={column}
          tasks={filteredTasks[column.id]}
          index={index}
          isDropTarget={dragTarget === column.id && dragOrigin !== column.id}
        />
      ))}
    </div>
  )
}

export function Board({ backlogOpen, onBacklogOpenChange }: BoardProps) {
  const { tasks, hasLoadedOnce, isLoading, setTasks, persistMove } = useBoardTasks()
  const { searchQuery } = useBoardSearch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOrigin, setDragOrigin] = useState<ColumnId | null>(null)
  const [dragTarget, setDragTarget] = useState<ColumnId | null>(null)
  const shouldSkipInitialLoading = hasLoadedOnce && !isLoading
  const initialResolvedContentState = shouldSkipInitialLoading
    ? (getMainBoardContentState({
        isHydrated: true,
        isLoading,
        tasks,
      }) as Exclude<MainBoardContentState, 'loading'>)
    : null
  const [isHydrated, setIsHydrated] = useState(() => shouldSkipInitialLoading)
  const [loadingStartedAt] = useState(() => Date.now())
  const [hasCompletedInitialReveal, setHasCompletedInitialReveal] = useState(
    () => shouldSkipInitialLoading
  )
  const [isLoaderMounted, setIsLoaderMounted] = useState(() => !shouldSkipInitialLoading)
  const [isLoaderVisible, setIsLoaderVisible] = useState(() => !shouldSkipInitialLoading)
  const [isResolvedContentVisible, setIsResolvedContentVisible] = useState(
    () => shouldSkipInitialLoading
  )
  const [resolvedContentState, setResolvedContentState] = useState<Exclude<
    MainBoardContentState,
    'loading'
  > | null>(() => initialResolvedContentState)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const boardContentState = getMainBoardContentState({
    isHydrated,
    isLoading,
    tasks,
  })

  useEffect(() => {
    if (hasCompletedInitialReveal) {
      if (boardContentState !== 'loading') {
        setResolvedContentState(boardContentState)
      }
      return
    }

    if (boardContentState === 'loading') return

    const remainingLoaderMs = getRemainingBoardLoaderMs({ loadingStartedAt })
    let revealFrameId = 0
    let hideLoaderTimerId = 0

    const revealTimerId = window.setTimeout(() => {
      setResolvedContentState(boardContentState)
      revealFrameId = window.requestAnimationFrame(() => {
        setIsResolvedContentVisible(true)
        setIsLoaderVisible(false)
      })
      hideLoaderTimerId = window.setTimeout(() => {
        setIsLoaderMounted(false)
        setHasCompletedInitialReveal(true)
      }, BOARD_REVEAL_FADE_MS)
    }, remainingLoaderMs)

    return () => {
      window.clearTimeout(revealTimerId)
      window.clearTimeout(hideLoaderTimerId)
      if (revealFrameId) window.cancelAnimationFrame(revealFrameId)
    }
  }, [boardContentState, hasCompletedInitialReveal, loadingStartedAt])

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks
    const query = searchQuery.toLowerCase()

    return {
      ...tasks,
      ...Object.fromEntries(
        COLUMNS.map(column => [
          column.id,
          tasks[column.id].filter(
            task =>
              task.title?.toLowerCase().includes(query) ||
              task.id?.toLowerCase().includes(query) ||
              task.project?.toLowerCase().includes(query)
          ),
        ])
      ),
    } satisfies Record<ColumnId, TaskCard[]>
  }, [tasks, searchQuery])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const allowedDropColumns = getAllowedDropColumns(dragOrigin)

  const active = activeId
    ? (Object.values(tasks)
        .flat()
        .find(task => task.id === activeId) as TaskCard | undefined)
    : undefined

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    const origin = findTaskColumn(tasks, id)
    setDragOrigin(origin)
    setDragTarget(origin)
  }

  function handleDragOver(event: DragOverEvent) {
    const overId = event.over ? String(event.over.id) : null
    if (!overId || !activeId) {
      setDragTarget(null)
      return
    }

    const fromColumn = findTaskColumn(tasks, activeId)
    const location = resolveDropLocation(tasks, overId, allowedDropColumns)
    setDragTarget(location?.column ?? null)

    if (!fromColumn || !location || fromColumn === location.column) return

    setTasks(current => insertTaskAtDropLocation(current, activeId, fromColumn, location))
  }

  function handleDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : null
    const draggedTaskId = String(event.active.id)
    const origin = dragOrigin
    setActiveId(null)
    setDragOrigin(null)
    setDragTarget(null)

    if (!overId || !origin) return

    const currentColumn = findTaskColumn(tasks, draggedTaskId)
    if (!currentColumn) return

    if (origin === currentColumn) {
      const dropLocation = resolveDropLocation(tasks, overId, allowedDropColumns)
      if (!dropLocation || dropLocation.column !== currentColumn) return

      const nextIndex =
        overId === currentColumn ? tasks[currentColumn].length - 1 : dropLocation.index
      const reorderedTasks = reorderTasksInColumn(tasks, currentColumn, draggedTaskId, nextIndex)

      if (reorderedTasks !== tasks) {
        setTasks(reorderedTasks)
      }

      const finalIndex = reorderedTasks[currentColumn].findIndex(task => task.id === draggedTaskId)
      if (finalIndex !== -1) {
        void persistMove(draggedTaskId, currentColumn, finalIndex)
      }
      return
    }

    const finalIndex = tasks[currentColumn].findIndex(task => task.id === draggedTaskId)
    if (finalIndex !== -1) {
      void persistMove(draggedTaskId, currentColumn, finalIndex)
    }
  }

  const collisionDetection: CollisionDetection = args => {
    const permittedContainers = args.droppableContainers.filter(container => {
      return resolveDropLocation(tasks, String(container.id), allowedDropColumns) !== null
    })

    if (backlogOpen && args.pointerCoordinates && typeof window !== 'undefined') {
      const sidebarLeft = Math.max(0, window.innerWidth - BACKLOG_PANEL_WIDTH_PX)
      if (args.pointerCoordinates.x >= sidebarLeft) {
        const backlogContainers = permittedContainers.filter(container => {
          return resolveDropLocation(tasks, String(container.id), ['backlog']) !== null
        })

        if (backlogContainers.length > 0) {
          const backlogPointerHits = pointerWithin({
            ...args,
            droppableContainers: backlogContainers,
          })
          if (backlogPointerHits.length > 0) return backlogPointerHits

          const backlogCornerHits = closestCorners({
            ...args,
            droppableContainers: backlogContainers,
          })
          if (backlogCornerHits.length > 0) return backlogCornerHits
        }
      }
    }

    const pointerHits = pointerWithin({
      ...args,
      droppableContainers: permittedContainers,
    })
    if (pointerHits.length > 0) return pointerHits

    return closestCorners({
      ...args,
      droppableContainers: permittedContainers,
    })
  }

  const resolvedBoardContent =
    resolvedContentState === 'empty' ? (
      <BoardEmptyState />
    ) : resolvedContentState === 'board' ? (
      renderBoardColumns({
        columns: COLUMNS,
        dragOrigin,
        dragTarget,
        filteredTasks,
      })
    ) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragOrigin(null)
        setDragTarget(null)
      }}
    >
      <div className="relative flex h-full min-h-0 flex-1">
        {resolvedBoardContent ? (
          <div
            className={[
              'flex h-full min-h-0 flex-1 self-stretch transition-opacity duration-300 ease-out motion-reduce:transition-none',
              isResolvedContentVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
          >
            {resolvedBoardContent}
          </div>
        ) : null}

        {isLoaderMounted ? (
          <div
            className={[
              'absolute inset-0 flex h-full min-h-0 w-full transition-opacity duration-300 ease-out motion-reduce:transition-none',
              isLoaderVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
            ].join(' ')}
          >
            <BoardLoadingState />
          </div>
        ) : null}
      </div>

      <BacklogPanel
        open={backlogOpen}
        onOpenChange={onBacklogOpenChange}
        isDropTarget={dragTarget === 'backlog' && dragOrigin !== 'backlog'}
      />

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {active ? (
          <TaskCardView
            task={active}
            column={findTaskColumn(tasks, active.id) ?? 'todo'}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
