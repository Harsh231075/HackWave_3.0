import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { z } from 'zod'
import { INITIAL_DRAFTS, INITIAL_EVENTS, INITIAL_TASKS } from '@/data/demo'
import { emptyFilters, workspaceReducer, type Action } from '@/domain/workspace'
import type { WorkspaceState } from '@/domain/types'

export const initialState = (): WorkspaceState => ({ tasks: structuredClone(INITIAL_TASKS), events: structuredClone(INITIAL_EVENTS), drafts: { ...INITIAL_DRAFTS }, dismissed: [], activity: ['Your workspace is ready for the week', 'Demo resources added to your workspace'], filters: emptyFilters(), pins: [], history: [] })
const storageKey = 'gogpt-workspace-v1'
const persistedSchema = z.object({
  tasks: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), context: z.string(), owner: z.string(), due: z.string(), duration: z.number(), priority: z.enum(['urgent', 'high', 'medium', 'low']), status: z.enum(['pending', 'blocked', 'completed']) })),
  events: z.array(z.object({ id: z.string(), title: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), category: z.enum(['meeting', 'focus', 'class', 'break']), participants: z.array(z.string()), agenda: z.string() })),
  drafts: z.record(z.string(), z.string()), dismissed: z.array(z.string()), activity: z.array(z.string()),
})
function restoreState(): WorkspaceState {
  const fallback = initialState()
  try { const raw = localStorage.getItem(storageKey); if (!raw) return fallback; const parsed = persistedSchema.safeParse(JSON.parse(raw)); return parsed.success ? { ...fallback, ...parsed.data } : fallback } catch { return fallback }
}
const WorkspaceContext = createContext<{
  state: WorkspaceState; dispatch: (action: Action) => void; notify: (message: string) => void; notice: string
  draftBuffers: Record<string, string>; editDraft: (key: string, value: string) => void
  selectedDate: string; selectDate: (date: string) => void; resetDemo: () => void
} | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, restoreState)
  const [notice, notify] = useState('')
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify({ tasks: state.tasks, events: state.events, drafts: state.drafts, dismissed: state.dismissed, activity: state.activity })) } catch { queueMicrotask(() => notify('Device storage is unavailable. Changes will last until reload.')) }
  }, [state.tasks, state.events, state.drafts, state.dismissed, state.activity])
  const [draftBuffers, setDraftBuffers] = useState<Record<string, string>>({})
  const [selectedDate, selectDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const editDraft = (key: string, value: string) => setDraftBuffers(current => ({ ...current, [key]: value }))
  const resetDemo = () => { dispatch({ type: 'reset', state: initialState() }); setDraftBuffers({}); selectDate(format(new Date(), 'yyyy-MM-dd')); notify('Demo restored. All local changes have been reset.') }
  return <WorkspaceContext.Provider value={{ state, dispatch, notice, notify, draftBuffers, editDraft, selectedDate, selectDate, resetDemo }}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace components require WorkspaceProvider.')
  return context
}
