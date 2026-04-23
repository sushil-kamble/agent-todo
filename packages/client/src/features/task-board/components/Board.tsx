import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { COLUMNS, type ColumnId, type TaskCard } from '#/entities/task/types'
import { useBoardSearch, useBoardTasks } from '#/features/task-board/model'
import {
  findTaskColumn,
  insertTaskAtDropLocation,
  reorderTasksInColumn,
  resolveDropLocation,
} from '#/features/task-board/model/drag-utils'
import { BacklogPanel } from './BacklogPanel'
import { BoardColumn } from './Column'
import { TaskCardView } from './TaskCardView'

type BoardProps = {
  backlogOpen: boolean
  onBacklogOpenChange: (open: boolean) => void
}

export function Board({ backlogOpen, onBacklogOpenChange }: BoardProps) {
  const { tasks, setTasks, persistMove } = useBoardTasks()
  const { searchQuery } = useBoardSearch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOrigin, setDragOrigin] = useState<ColumnId | null>(null)
  const [dragTarget, setDragTarget] = useState<ColumnId | null>(null)

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
    const location = resolveDropLocation(tasks, overId)
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
      const dropLocation = resolveDropLocation(tasks, overId)
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setDragOrigin(null)
        setDragTarget(null)
      }}
    >
      <div className="flex min-h-0 flex-1">
        <div className="grid h-full min-h-0 flex-1 grid-cols-3 gap-5 items-stretch">
          {COLUMNS.map((column, index) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={filteredTasks[column.id]}
              index={index}
              isDropTarget={dragTarget === column.id && dragOrigin !== column.id}
            />
          ))}
        </div>
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
