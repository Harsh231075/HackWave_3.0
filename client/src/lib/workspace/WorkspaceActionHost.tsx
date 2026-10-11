import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { usePinnedWidgets } from '@/hooks/usePinnedWidgets'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { WorkspaceActionContext } from './WorkspaceActionContext'
import type { ActionOrigin } from '@/domain/workspaceActions'
import type { PreparedWorkspaceAction } from '@/services/workspaceActionService'
import { workspaceActionService } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { TaskForm } from '@/components/tasks/TaskWidgets'
import { FocusScheduleDialog } from '@/components/tasks/FocusScheduleDialog'
import { DraftEditor } from '@/components/resources/DraftEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function WorkspaceActionHost({ revision, pending, onGoalChange, children }: { revision: number; pending: boolean; onGoalChange: (goal: string) => Promise<void>; children: ReactNode }) {
  const { notify } = useWorkspace()
  const pins = usePinnedWidgets()
  const calendar = useGoogleCalendar()
  const [editor, setEditor] = useState<PreparedWorkspaceAction | null>(null)
  const current = useRef({ revision, pending })
  useLayoutEffect(() => { current.current = { revision, pending } }, [revision, pending])
  const running = useRef(false)
  const returnFocus = useRef<HTMLElement | null>(null)
  const closeEditor = useCallback(() => {
    setEditor(null)
    requestAnimationFrame(() => {
      const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('[aria-label="Generated productivity workspace"]')
      target?.focus({ preventScroll: true })
    })
  }, [])
  function isCurrent(origin: ActionOrigin) { return (origin.binding.kind !== 'google-calendar' || calendar.connection?.connected === true && calendar.connection.accountId === origin.binding.accountId) && origin.revision === current.current.revision && !current.current.pending }
  function dispatch(value: unknown, origin: ActionOrigin) {
    if (!isCurrent(origin) || running.current) return
    const result = workspaceActionService.prepare(value, origin)
    if (!result.ok) { notify(result.message); return }
    if (result.value.type === 'goal.change') {
      setEditor(null); running.current = true
      void onGoalChange(result.value.goal).finally(() => { running.current = false })
    } else { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setEditor(result.value) }
  }
  const pinExists = !editor?.origin.pinId || (pins.status === 'found' && pins.value.some(pin => pin.pinId === editor.origin.pinId && JSON.stringify(pin.binding) === JSON.stringify(editor.origin.binding)))
  const active = editor && editor.origin.revision === revision && !pending && (editor.origin.binding.kind !== 'google-calendar' || calendar.connection?.connected === true && calendar.connection.accountId === editor.origin.binding.accountId) && pinExists ? editor : null
  useEffect(() => {
    if (!active) return
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[data-slot="select-content"][data-open]')) return
      event.preventDefault(); event.stopPropagation(); closeEditor()
    }
    document.addEventListener('keydown', escape, true)
    return () => document.removeEventListener('keydown', escape, true)
  }, [active, closeEditor])
  return <WorkspaceActionContext.Provider value={{ revision, pending, dispatch }}>{children}
    {active?.type === 'task.edit' && <TaskForm key={active.task.id} task={active.task} open onClose={closeEditor} onSave={input => isCurrent(active.origin) ? workspaceActionService.saveTask(active, input) : { ok: false, message: 'This view changed. Reopen the editor.' }} />}
    {active?.type === 'focus.schedule' && <FocusScheduleDialog key={active.task.id} task={active.task} origin={active.origin} initialDate={active.date} onClose={closeEditor} isCurrent={() => isCurrent(active.origin)} />}
    {active?.type === 'draft.edit' && <Dialog open onOpenChange={open => { if (!open) closeEditor() }}><DialogContent><DialogHeader><DialogTitle>{active.label}</DialogTitle><DialogDescription className="sr-only">Edit your locally saved draft. Unsaved text is kept when closed.</DialogDescription></DialogHeader><DraftEditor draftKey={active.key} label={active.label} fallback={active.fallback} onSave={value => isCurrent(active.origin) ? workspaceActionService.saveDraft(active, value) : { ok: false, message: 'This view changed. Your unsaved draft is kept.' }} /></DialogContent></Dialog>}
  </WorkspaceActionContext.Provider>
}
