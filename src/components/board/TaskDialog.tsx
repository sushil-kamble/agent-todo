import { useEffect } from 'react'
import { useBoard } from './store'
import { ChatPanel } from './task-dialog/ChatPanel'
import { FormPanel } from './task-dialog/FormPanel'
import { ReadonlyPanel } from './task-dialog/ReadonlyPanel'

export function TaskDialog() {
  const {
    dialogOpen,
    closeNewTask,
    addTask,
    editingTask,
    editingColumn,
    closeEditTask,
    updateTask,
  } = useBoard()

  const isEdit = !!editingTask
  const isOpen = dialogOpen || isEdit
  const close = isEdit ? closeEditTask : closeNewTask

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [isOpen, close])

  if (!isOpen) return null

  const mode: 'form' | 'chat' | 'readonly' =
    isEdit && editingColumn === 'in_progress'
      ? 'chat'
      : isEdit && editingColumn === 'done'
        ? 'readonly'
        : 'form'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={close}
        className="absolute inset-0 bg-foreground/30 backdrop-blur-[2px]"
      />

      {mode === 'form' && (
        <FormPanel
          isEdit={isEdit}
          editingTask={editingTask}
          editingColumn={editingColumn}
          close={close}
          onCreate={input => {
            addTask(input)
            closeNewTask()
          }}
          onUpdate={(id, updates, col) => {
            updateTask(id, updates, col, col)
            closeEditTask()
          }}
        />
      )}

      {mode === 'chat' && editingTask && <ChatPanel task={editingTask} close={close} />}

      {mode === 'readonly' && editingTask && <ReadonlyPanel task={editingTask} close={close} />}
    </div>
  )
}
