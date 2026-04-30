import { useCallback, useEffect } from 'react'
import { ChatPanel } from '#/features/run-console/components/ChatPanel'
import { useBoardDialogs, useBoardTasks } from '#/features/task-board/model'
import { FormPanel } from './FormPanel'

export function TaskDialog() {
  const { addTask, refresh, updateTask, removeTask } = useBoardTasks()
  const {
    dialogOpen,
    createKind,
    dialogView,
    closeCreateDialog,
    editingTask,
    editingColumn,
    closeEditTask,
  } = useBoardDialogs()

  const isEdit = !!editingTask
  const isOpen = dialogOpen || isEdit
  const createColumn = createKind === 'backlog' ? 'backlog' : 'todo'
  const dismiss = useCallback(() => {
    if (isEdit) {
      closeEditTask()
      return
    }
    closeCreateDialog()
  }, [closeCreateDialog, closeEditTask, isEdit])

  const refreshAfterMutation = useCallback(
    (mutation: Promise<void>) => {
      void mutation
        .then(() => refresh())
        .catch(error => {
          console.error('[task-dialog] mutation failed', error)
        })
    },
    [refresh]
  )

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      dismiss()
    }
    window.addEventListener('keydown', handler, true)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler, true)
      document.body.style.overflow = ''
    }
  }, [isOpen, dismiss])

  if (!isOpen) return null

  const mode: 'form' | 'chat' =
    isEdit && (dialogView === 'chat' || editingColumn === 'in_progress' || editingColumn === 'done')
      ? 'chat'
      : 'form'
  const readOnly = editingColumn === 'done' || editingColumn === 'backlog'

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={dismiss}
        className="animate-in fade-in absolute inset-0 bg-foreground/30 backdrop-blur-[2px] duration-200"
      />

      {mode === 'form' && (
        <FormPanel
          createKind={createKind ?? 'task'}
          isEdit={isEdit}
          createColumn={createColumn}
          editingTask={editingTask}
          editingColumn={editingColumn}
          close={dismiss}
          onCreate={input => {
            addTask(input)
            closeCreateDialog()
          }}
          onUpdate={(id, updates, fromColumn, toColumn) => {
            closeEditTask()
            refreshAfterMutation(updateTask(id, updates, fromColumn, toColumn))
          }}
          onDelete={id => {
            closeEditTask()
            void removeTask(id, editingColumn ?? 'todo').catch(error => {
              console.error('[task-dialog] delete failed', error)
            })
          }}
          onMoveToBacklog={(id, updates) => {
            closeEditTask()
            refreshAfterMutation(updateTask(id, updates, 'todo', 'backlog'))
          }}
        />
      )}

      {mode === 'chat' && editingTask && (
        <ChatPanel task={editingTask} close={dismiss} readOnly={readOnly} />
      )}
    </div>
  )
}
