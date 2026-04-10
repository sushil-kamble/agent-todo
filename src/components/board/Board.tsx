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
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useMemo, useState } from 'react'
import { useBoardSearch, useBoardTasks } from '#/stores/board'
import { BoardColumn } from './Column'
import { TaskCardView } from './TaskCardView'
import { COLUMNS, type ColumnId, type TaskCard } from './types'

export function Board() {
  const { tasks, setTasks, persistMove } = useBoardTasks()
  const { searchQuery } = useBoardSearch()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [dragOrigin, setDragOrigin] = useState<ColumnId | null>(null)

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks
    const query = searchQuery.toLowerCase()

    return Object.fromEntries(
      COLUMNS.map(col => [
        col.id,
        tasks[col.id].filter(
          t =>
            t.title?.toLowerCase().includes(query) ||
            t.id?.toLowerCase().includes(query) ||
            t.project?.toLowerCase().includes(query) ||
            t.tag?.toLowerCase().includes(query)
        ),
      ])
    ) as Record<ColumnId, TaskCard[]>
  }, [tasks, searchQuery])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findColumn = (id: string): ColumnId | null => {
    if ((['todo', 'in_progress', 'done'] as ColumnId[]).includes(id as ColumnId)) {
      return id as ColumnId
    }
    for (const col of COLUMNS) {
      if (tasks[col.id].some(t => t.id === id)) return col.id
    }
    return null
  }

  const active = activeId
    ? (Object.values(tasks)
        .flat()
        .find(t => t.id === activeId) as TaskCard | undefined)
    : undefined

  function handleDragStart(e: DragStartEvent) {
    const id = String(e.active.id)
    setActiveId(id)
    setDragOrigin(findColumn(id))
  }

  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e
    if (!over) return
    const fromCol = findColumn(String(active.id))
    const toCol = findColumn(String(over.id))
    if (!fromCol || !toCol || fromCol === toCol) return

    setTasks(prev => {
      const fromItems = prev[fromCol]
      const toItems = prev[toCol]
      const movingIdx = fromItems.findIndex(t => t.id === active.id)
      if (movingIdx === -1) return prev
      const moving = fromItems[movingIdx]
      return {
        ...prev,
        [fromCol]: fromItems.filter(t => t.id !== active.id),
        [toCol]: [...toItems, moving],
      }
    })
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    const activeIdStr = String(active.id)
    const origin = dragOrigin
    setActiveId(null)
    setDragOrigin(null)
    if (!over) return
    const col = findColumn(activeIdStr)
    if (!col) return
    const items = tasks[col]
    const oldIdx = items.findIndex(t => t.id === active.id)
    const newIdx = items.findIndex(t => t.id === over.id)

    const finalCol = col
    let finalIdx = oldIdx
    if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
      setTasks(prev => ({ ...prev, [col]: arrayMove(prev[col], oldIdx, newIdx) }))
      finalIdx = newIdx
    }

    // Persist column transitions (this is what kicks off codex on in_progress).
    if (origin && origin !== finalCol) {
      void persistMove(activeIdStr, finalCol, Math.max(0, finalIdx))
    } else if (origin === finalCol && oldIdx !== newIdx) {
      void persistMove(activeIdStr, finalCol, Math.max(0, finalIdx))
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid h-full min-h-0 grid-cols-3 gap-5">
        {COLUMNS.map((col, i) => (
          <BoardColumn key={col.id} column={col} tasks={filteredTasks[col.id]} index={i} />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {active ? (
          <TaskCardView task={active} column={findColumn(active.id) ?? 'todo'} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
