import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { browserDatabase, meetingPreparationService } from '@/services'
import type { MeetingComposition } from '@/domain/adaptiveData'
import { createPreparationStore } from '@/services/preparationStore'
import { MeetingScopeContext } from './MeetingScopeContext'

export function MeetingScopeProvider({ meetingId, composition, children }: { meetingId: string; composition: MeetingComposition; children: ReactNode }) {
  const store = useMemo(() => createPreparationStore(browserDatabase, meetingPreparationService.load, meetingId), [meetingId])
  const result = useSyncExternalStore(store.subscribe, store.getSnapshot)
  if (result.status !== 'found') return <p role="alert" className="p-4 text-sm text-muted-foreground">This meeting’s records are unavailable. Open the command window to choose another meeting.</p>
  return <MeetingScopeContext.Provider value={{ data: result.value, composition }}>{children}</MeetingScopeContext.Provider>
}
export function UnscopedWidget({ children }: { children: ReactNode }) {
  return <MeetingScopeContext.Provider value={null}>{children}</MeetingScopeContext.Provider>
}
