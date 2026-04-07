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
import { useState } from 'react'
import { BoardColumn } from './Column'
import { useBoard } from './store'
import { TaskCardView } from './TaskCardView'
import { COLUMNS, type ColumnId, type TaskCard } from './types'

export function Board() {
  const { tasks, setTasks } = useBoard()
  const [activeId, setActiveId] = useState<string | null>(null)

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
    setActiveId(String(e.active.id))
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
    setActiveId(null)
    if (!over) return
    const col = findColumn(String(active.id))
    if (!col) return
    const items = tasks[col]
    const oldIdx = items.findIndex(t => t.id === active.id)
    const newIdx = items.findIndex(t => t.id === over.id)
    if (oldIdx === -1 || newIdx === -1 || oldIdx === newIdx) return
    setTasks(prev => ({ ...prev, [col]: arrayMove(prev[col], oldIdx, newIdx) }))
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
          <BoardColumn key={col.id} column={col} tasks={tasks[col.id]} index={i} />
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
