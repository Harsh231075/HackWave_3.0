import { useWidgetPresentation } from './WidgetPresentation'
import { calendarDate } from '@/domain/calendar'
import { useNavigate } from 'react-router-dom'
import { InstanceCanvas } from './InstanceCanvas'
import { useWorkspaceDocument } from '@/hooks/useWorkspaceDocument'
import { makeInstance } from '@/services/workspaceDocumentService'
import { WorkspaceActionHost } from './WorkspaceActionHost'
import { ActionOriginProvider } from './ActionOriginProvider'
import { WorkspaceActionContext } from './WorkspaceActionContext'

import { pinService, browserDatabase } from '@/services'
import { usePinnedWidgets } from '@/hooks/usePinnedWidgets'
import { useWidgetInstance } from '@/hooks/useWidgetInstance'
import { widgetSelectionKey, widgetViewStateSchema, type PinnedWidget, type WidgetInstance } from '@/domain/widgetInstances'
import type { UsageQuery } from '@/domain/usage'
import { WidgetSelectionContext, PinControlsContext } from './WidgetSelectionContext'
import { useUsageScope } from '@/state/UsageScopeContext'
import { UsageEvidence } from '@/components/insights/UsageWorkspaceWidgets'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { OverdueEvidence } from '@/components/tasks/OverdueWidgets'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { MeetingEvidence } from '@/components/resources/MeetingPreparationWidgets'
import { Component, useContext, useState, useCallback, type ErrorInfo, type ReactNode } from 'react'
import { Info, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { configSchema, type WidgetType } from './config'
import { registry, widgetTitle } from './registry'
import { WidgetHeaderContext, WidgetPageActionsContext } from './WidgetHeaderContext'

class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace widget failed', error, info.componentStack) }
  render() { return this.state.failed ? <p className="[color:#ef4444] text-[length:0.8rem] font-medium p-5" role="alert">This widget couldn’t render. Switch views or reload to try again.</p> : this.props.children }
}
export function WidgetFrame({ id, children, pageActions = false, instance, recordsChanged = false, span = 'full' }: { id: WidgetType; children: ReactNode; pageActions?: boolean; instance?: WidgetInstance | PinnedWidget; recordsChanged?: boolean; span?: WidgetInstance['span'] }) {
  const presentation = useWidgetPresentation()
  const { notify } = useWorkspace()
  const actionHost = useContext(WorkspaceActionContext)
  const pins = usePinnedWidgets()
  const pinControls = useContext(PinControlsContext)
  const [usageQuery, setUsageQuery] = useState<UsageQuery | null>(null)
  const registerQuery = useCallback((query: UsageQuery | null) => {
    setUsageQuery(current => JSON.stringify(current) === JSON.stringify(query) ? current : query)
  }, [])
  const captured = useWidgetInstance(id, span, usageQuery)
  const selected = instance && id === 'usage' && instance.binding.kind === 'workspace' ? usageQuery ? { ...instance, binding: { kind: 'usage-query' as const, query: usageQuery } } : null : instance ?? captured
  const savedPin = (instance && 'pinId' in instance ? instance : undefined) ?? (pins.status === 'found' && selected ? pins.value.find(p => instance ? p.instanceId === instance.instanceId : widgetSelectionKey(p) === widgetSelectionKey(selected!)) : undefined)
  const toggle = () => {
    if (!selected) return
    const result = savedPin ? pinService.unpinWidget(savedPin.pinId) : pinService.pinWidget(selected)
    if (result.ok && instance) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-label="Generated productivity workspace"]')?.focus({ preventScroll: true }))
    notify(!result.ok ? result.message : result.persistence.status === 'saved' ? '' : 'Pins updated for this session. Device storage is unavailable.')
  }
  const [why, setWhy] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  const usage = useUsageScope()
  const overdue = useOverdueScope()
  const meetingScope = useMeetingScope()
  const definition = registry[id]
  const Icon = definition.icon
  const pinned = !!savedPin
  const actionLabel = `${pinned ? 'Unpin' : 'Pin'} ${widgetTitle(id)}${selected && !(selected.binding.kind === 'workspace') ? ' · ' + selected.label : ''}`
  return <WidgetSelectionContext.Provider value={registerQuery}><WidgetPageActionsContext.Provider value={pageActions}><WidgetHeaderContext.Provider value={headerSlot}><section style={presentation ? { minHeight: presentation.variant.minHeight } : undefined} className={`bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] flex flex-col p-5 h-full widget-${id}`} aria-label={widgetTitle(id)} data-widget-instance={selected?.instanceId}><header className="flex flex-wrap gap-3 justify-between items-center mb-4 pb-3 [border-bottom:1px_solid_var(--border)] [&_h2]:text-[length:1.05rem] [&_h2]:font-semibold [&_h2]:inline-flex [&_h2]:items-center [&_h2]:[gap:0.55rem] [&_h2_svg]:text-(--primary)"><h2><Icon size={16} />{widgetTitle(id)}</h2><div className="ml-auto flex flex-wrap items-center gap-2"><div ref={setHeaderSlot} className="flex flex-wrap items-center gap-2" /><div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Why show ${widgetTitle(id)}?`} aria-expanded={why} onClick={() => setWhy(!why)}><Info size={14} /></Button>{pinControls && <Button disabled={!selected} variant="ghost" size="icon-sm" className={pinned ? 'text-(--primary)! bg-(--accent)!' : ''} aria-label={actionLabel} aria-pressed={pinned} onClick={toggle}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</Button>}</div></div></header>{why && <div className="bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0.65rem_0.85rem] mb-4 text-[length:0.82rem] [&_strong]:block [&_strong]:text-[length:0.75rem] [&_strong]:text-(--primary) [&_strong]:[margin-bottom:0.2rem] [&_p]:text-(--muted-foreground)"><strong>Why this component</strong>{recordsChanged && !usage && <p role="status">Supporting records changed since this view was pinned. The explanation refers to its original evidence.</p>}{usage ? <UsageEvidence widgetId={id} /> : overdue ? <OverdueEvidence widgetId={id} /> : meetingScope ? <MeetingEvidence widgetId={id} /> : <p>{instance?.explanation.reason ?? definition.reason}</p>}</div>}<div className={presentation ? 'widget-presentation-body' : undefined} style={presentation?.variant.scrollContent ? { maxHeight: Math.max(160, presentation.variant.preferredHeight - 110), overflow: 'auto', minWidth: 0 } : undefined}><WidgetBoundary>{selected && actionHost ? <ActionOriginProvider origin={{ binding: selected.binding, referenceDate: selected.viewState.referenceDate ?? (selected.binding.kind === 'overdue' ? selected.binding.referenceDate : calendarDate()), revision: actionHost.revision, instanceId: selected.instanceId.startsWith('preset:') ? undefined : selected.instanceId, pinId: instance && 'pinId' in instance ? instance.pinId : undefined }}>{children}</ActionOriginProvider> : children}</WidgetBoundary></div></section></WidgetHeaderContext.Provider></WidgetPageActionsContext.Provider></WidgetSelectionContext.Provider>
}
export function WorkspaceRenderer({ config, pageActionWidget }: { config: unknown; pageActionWidget?: WidgetType }) {
  const workspace = useWorkspaceDocument()
  const navigate = useNavigate()
  const parsed = configSchema.safeParse(config)
  if (!parsed.success) return <p role="alert">This layout is unavailable. Choose another preview.</p>
  const saved = browserDatabase.readCollection('pageViews')
  const views = saved.status === 'found' && saved.value && typeof saved.value === 'object' && !Array.isArray(saved.value) ? saved.value as Record<string, unknown> : {}
  const instances = parsed.data.widgets.map(widget => {
    const key = widget.id
    const view = widgetViewStateSchema.safeParse(views[key])
    return { ...makeInstance(widget.id, { kind: 'workspace',   }, view.success ? view.data : {}, `preset:${key}`), span: widget.span }
  })
  return <WorkspaceActionHost revision={workspace.document.revision} pending={false} onGoalChange={async goal => { navigate('/', { state: { goal } }) }}>
    {workspace.notice && <p role="status">{workspace.notice}</p>}
    <InstanceCanvas instances={instances} pageActionWidget={pageActionWidget} update={instance => {
      if (saved.status === 'invalid') { workspace.setNotice('Saved page views are invalid. Reset local data in Settings to repair them.'); return }
      const result = browserDatabase.writeCollection('pageViews', {...views,[instance.widgetType]:instance.viewState})
      if(result.status !== 'saved') workspace.setNotice('View preferences are kept for this session. Device storage is unavailable.')
    }} />
  </WorkspaceActionHost>
}
