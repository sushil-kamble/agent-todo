import { useEffect } from 'react'
import { useBoardDialogs, useBoardTasks } from '#/stores/board'
import { ChatPanel } from './task-dialog/ChatPanel'
import { FormPanel } from './task-dialog/FormPanel'

export function TaskDialog() {
  const { addTask, refresh, updateTask } = useBoardTasks()
  const { dialogOpen, closeNewTask, editingTask, editingColumn, closeEditTask } = useBoardDialogs()

  const isEdit = !!editingTask
  const isOpen = dialogOpen || isEdit
  const close = isEdit
    ? () => {
        closeEditTask()
        void refresh()
      }
    : closeNewTask

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

  const mode: 'form' | 'chat' =
    isEdit && (editingColumn === 'in_progress' || editingColumn === 'done') ? 'chat' : 'form'
  const readOnly = editingColumn === 'done'

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
        className="animate-in fade-in absolute inset-0 bg-foreground/30 backdrop-blur-[2px] duration-200"
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
            close()
          }}
        />
      )}

      {mode === 'chat' && editingTask && (
        <ChatPanel task={editingTask} close={close} readOnly={readOnly} />
      )}
    </div>
  )
}
