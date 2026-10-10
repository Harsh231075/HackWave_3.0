import { UsageScopeContext } from './UsageScopeContext'
import { OverdueScopeContext } from './OverdueScopeContext'
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { browserDatabase, meetingPreparationService } from '@/services'
import type { MeetingLayout } from '@/services/layoutService'
import type { Filters } from '@/domain/types'
import { filterTasks } from '@/domain/workspace'
import { DEMO_DATE } from '@/data/demo'
import { createPreparationStore } from '@/services/preparationStore'
import { MeetingScopeContext } from './MeetingScopeContext'

export function MeetingScopeProvider({ session, onFilters, children }: { session: MeetingLayout; onFilters: (filters: Filters) => void; children: ReactNode }) {
  const { meetingId, composition, taskFilters } = session
  const store = useMemo(() => createPreparationStore(browserDatabase, meetingPreparationService.load, meetingId), [meetingId])
  const result = useSyncExternalStore(store.subscribe, store.getSnapshot)
  if (result.status !== 'found') return <p role="alert" className="p-4 text-sm text-muted-foreground">This meeting’s records are unavailable. Open the command window to choose another meeting.</p>
  return <MeetingScopeContext.Provider value={{ data: result.value, composition, tasks: filterTasks(result.value.tasks, taskFilters, DEMO_DATE), filters: taskFilters, updateFilters: patch => onFilters({ ...taskFilters, ...patch }) }}>{children}</MeetingScopeContext.Provider>
}
export function UnscopedWidget({ children }: { children: ReactNode }) {
  return <UsageScopeContext.Provider value={null}><OverdueScopeContext.Provider value={null}><MeetingScopeContext.Provider value={null}>{children}</MeetingScopeContext.Provider></OverdueScopeContext.Provider></UsageScopeContext.Provider>
}
