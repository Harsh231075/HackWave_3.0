import { useComponentView } from './ComponentViewContext'
import { selectViewTasks } from '@/domain/componentIntent'
import type { WidgetExplanation } from '@/domain/widgetInstances'
import { createRecordStore } from '@/services/preparationStore'
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { browserDatabase, overdueReviewService } from '@/services'
import type { OverdueLayout } from '@/services/layoutService'
import type { Filters } from '@/domain/types'
import { filterTasks } from '@/domain/workspace'
import { OverdueScopeContext } from './OverdueScopeContext'
export function OverdueScopeProvider({ session, onFilters, children }: { session: Pick<OverdueLayout, 'intent' | 'filters' | 'referenceDate'> & { composition: { widgets: WidgetExplanation[] } }; onFilters: (filters: Filters) => void; children: ReactNode }) {
  const component = useComponentView()
  const store = useMemo(() => createRecordStore(browserDatabase, () => overdueReviewService.load(session.intent, session.referenceDate)), [session.intent, session.referenceDate])
  const result = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  if (result.status !== 'found') return <p role="alert">This project’s records are unavailable. Choose another workspace goal.</p>
  const tasks = component ? selectViewTasks(result.value.tasks, component.plan) : filterTasks(result.value.tasks, session.filters, session.referenceDate)
  return <OverdueScopeContext.Provider value={{ data: result.value, composition: session.composition, intent: session.intent, tasks, filters: session.filters, updateFilters: patch => onFilters({ ...session.filters, ...patch }) }}>{children}</OverdueScopeContext.Provider>
}
