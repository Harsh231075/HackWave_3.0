import { useComponentView } from './ComponentViewContext'
import { selectViewTasks } from '@/domain/componentIntent'
import type { WidgetExplanation } from '@/domain/widgetInstances'
import { filterTasks } from '@/domain/workspace'
import { DEMO_DATE } from '@/data/demo'
import type { Filters } from '@/domain/types'
import { usageSnapshotFingerprint } from '@/domain/usageComposition'
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { browserDatabase, usageWorkspaceService } from '@/services'
import { createRecordStore } from '@/services/preparationStore'
import type { UsageLayout } from '@/services/layoutService'
import type { UsageWorkspace } from '@/services/usageWorkspaceService'
import { UsageScopeContext } from './UsageScopeContext'
export function UsageScopeProvider({ session, onFilters, children }: { session: Pick<UsageLayout, 'intent' | 'taskFilters' | 'snapshotFingerprint'> & { composition: { widgets: WidgetExplanation[] } }; onFilters: (filters: Filters) => void; children: ReactNode }) {
  const component = useComponentView()
  const store = useMemo(() => createRecordStore<UsageWorkspace>(browserDatabase, () => usageWorkspaceService.load(session.intent)), [session.intent])
  const result = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  if (result.status !== 'found') return <p role="alert">These usage records are unavailable. Choose another workspace goal.</p>
  return <UsageScopeContext.Provider value={{ data: result.value, tasks: component ? selectViewTasks(result.value.snapshot.tasks, component.plan) : filterTasks(result.value.snapshot.tasks, session.taskFilters, DEMO_DATE), filters: session.taskFilters, updateFilters: patch => onFilters({ ...session.taskFilters, ...patch }), composition: session.composition, evidenceChanged: usageSnapshotFingerprint(result.value.snapshot) !== session.snapshotFingerprint, intent: session.intent }}>{children}</UsageScopeContext.Provider>
}
