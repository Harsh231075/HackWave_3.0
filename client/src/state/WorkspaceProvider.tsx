import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { format } from 'date-fns'
import type { ActionResult, EventInput, TaskInput } from '@/domain/commands'
import type { Event, Filters, Task, WorkspaceState } from '@/domain/types'
import { browserDatabase, draftService, eventService, recommendationService, taskService } from '@/services'
interface WorkspaceContextValue {
  state: WorkspaceState; notify: (message: string) => void; notice: string
  draftBuffers: Record<string, string>; editDraft: (key: string, value: string) => void
  selectedDate: string; selectDate: (date: string) => void; resetDemo: () => void
  saveTask: (input: TaskInput) => ActionResult<Task>
  toggleTask: (id: string) => ActionResult<Task>
  saveEvent: (input: EventInput) => ActionResult<Event>
  addFocusTime: (taskId: string) => ActionResult<Event>
  deleteEvent: (id: string) => ActionResult<void>
  saveDraft: (key: string, value: string) => ActionResult<void>
  dismissRecommendation: (id: string) => void
  updateFilters: (patch: Partial<Filters>) => void
  togglePin: (id: string) => void
  undo: () => void
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getState)
  const [notice, setNotice] = useState('')
  const notify = (message: string) => setNotice(message && browserDatabase.getPersistenceResult().status !== 'saved' ? 'Device storage is unavailable. Changes will last until reload.' : message)
  const run = <T,>(operation: () => T): T => {
    const result = operation()
    if (browserDatabase.getPersistenceResult().status !== 'saved') notify('Device storage is unavailable. Changes will last until reload.')
    return result
  }
  const [draftBuffers, setDraftBuffers] = useState<Record<string, string>>({})
  const [selectedDate, selectDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const editDraft = (key: string, value: string) => setDraftBuffers(current => ({ ...current, [key]: value }))
  const resetDemo = () => { run(() => browserDatabase.reset()); setDraftBuffers({}); selectDate(format(new Date(), 'yyyy-MM-dd')); if (browserDatabase.getPersistenceResult().status === 'saved') notify('Demo restored. All local changes have been reset.') }
  return <WorkspaceContext.Provider value={{ state, notice, notify, draftBuffers, editDraft, selectedDate, selectDate, resetDemo,
    saveTask: input => run(() => taskService.save(input)), toggleTask: id => run(() => taskService.toggle(id)),
    saveEvent: input => run(() => eventService.save(input)), deleteEvent: id => run(() => eventService.delete(id)),
    saveDraft: (key, value) => run(() => draftService.save(key, value)), addFocusTime: id => run(() => recommendationService.accept(id)),
    dismissRecommendation: id => run(() => recommendationService.dismiss(id)),
    updateFilters: patch => browserDatabase.dispatch({ type: 'filters', patch }), togglePin: id => browserDatabase.dispatch({ type: 'pin', id }),
    undo: () => run(() => browserDatabase.dispatch({ type: 'undo' })),
  }}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace components require WorkspaceProvider.')
  return context
}
