import { extractActiveWidgets } from './workspaceNodes'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { productivityLibrary } from './OpenUIWorkspace'
import { useWidgetInstanceFactory } from '@/hooks/useWidgetInstance'
import { usePinnedWidgets } from '@/hooks/usePinnedWidgets'
import { planWidgetCanvas } from '@/domain/widgetInstances'
import type { UsageQuery } from '@/domain/usage'
import { WidgetCanvasContext } from './WidgetCanvasContext'

export function ActiveWidgetCanvas({ response, children }: { response: string; children: ReactNode }) {
  const loaded = usePinnedWidgets()
  const createInstance = useWidgetInstanceFactory()
  const [usageQuery, setQuery] = useState<UsageQuery | null>(null)
  const setUsageQuery = useCallback((query: UsageQuery | null) => setQuery(current => JSON.stringify(current) === JSON.stringify(query) ? current : query), [])
  const descriptors = useMemo(() => { try { return extractActiveWidgets(response, productivityLibrary.toJSONSchema(), productivityLibrary.root) } catch { return [] } }, [response])
  const active = descriptors.map(w => createInstance(w.id, w.span, usageQuery) ?? { instanceId: `active:${w.id}`, widgetType: w.id, span: w.span, binding: { kind: 'workspace' as const }, viewState: { taskFilters: { query: '', status: 'all', priority: 'all', sort: 'due' as const, from: '', to: '' } }, explanation: { type: w.id, reason: '', evidence: [] }, fingerprint: '', label: 'Workspace' })
  const plan = planWidgetCanvas(active, loaded.status === 'found' ? loaded.value : [], active.find(w => w.binding.kind !== 'workspace')?.binding.kind)
  const value = { visible: new Set(plan.active.map(w => w.widgetType)), usageQuery, setUsageQuery }
  return <WidgetCanvasContext.Provider value={value}>{plan.omitted > 0 && <p className="mb-3 text-xs text-muted-foreground" role="status">{plan.omitted} optional {plan.omitted === 1 ? 'view is' : 'views are'} hidden to keep your pinned views. Unpin a view to restore them.</p>}{children}</WidgetCanvasContext.Provider>
}
