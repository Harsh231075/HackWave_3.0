import { createContext, useContext, useReducer, useState, type ReactNode } from 'react'
import { DEMO_DATE, INITIAL_DRAFTS, INITIAL_EVENTS, INITIAL_TASKS } from '@/data/demo'
import { emptyFilters, workspaceReducer, type Action } from '@/domain/workspace'
import type { WorkspaceState } from '@/domain/types'

export const initialState = (): WorkspaceState => ({ tasks: structuredClone(INITIAL_TASKS), events: structuredClone(INITIAL_EVENTS), drafts: { ...INITIAL_DRAFTS }, dismissed: [], activity: ['Your workspace is ready for the week', 'Demo resources added to your workspace'], filters: emptyFilters(), pins: [], history: [] })
const WorkspaceContext = createContext<{
  state: WorkspaceState; dispatch: (action: Action) => void; notify: (message: string) => void; notice: string
  draftBuffers: Record<string, string>; editDraft: (key: string, value: string) => void
  selectedDate: string; selectDate: (date: string) => void; resetDemo: () => void
} | null>(null)
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, initialState)
  const [notice, notify] = useState('')
  const [draftBuffers, setDraftBuffers] = useState<Record<string, string>>({})
  const [selectedDate, selectDate] = useState(DEMO_DATE)
  const editDraft = (key: string, value: string) => setDraftBuffers(current => ({ ...current, [key]: value }))
  const resetDemo = () => { dispatch({ type: 'reset', state: initialState() }); setDraftBuffers({}); selectDate(DEMO_DATE); notify('Demo restored. All local changes have been reset.') }
  return <WorkspaceContext.Provider value={{ state, dispatch, notice, notify, draftBuffers, editDraft, selectedDate, selectDate, resetDemo }}>{children}</WorkspaceContext.Provider>
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) throw new Error('Workspace components require WorkspaceProvider.')
  return context
}
