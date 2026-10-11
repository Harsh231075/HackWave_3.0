import { useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { usePinnedWidgets } from '@/hooks/usePinnedWidgets'
import { browserDatabase, pinService } from '@/services'
import { createRecordStore } from '@/services/preparationStore'
import { loadPinnedRecords } from '@/services/pinnedRecords'
import { useWorkspace, WorkspaceViewProvider } from '@/state/WorkspaceProvider'
import { MeetingScopeProvider, UnscopedWidget } from '@/state/MeetingScope'
import { UsageScopeProvider } from '@/state/UsageScope'
import { OverdueScopeProvider } from '@/state/OverdueScope'
import { DisplayPreferencesContext } from '@/state/displayPreferencesContext'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { registry } from './registry'
import { WidgetFrame } from './WorkspaceRenderer'
import { DataUsageExplorer } from '@/components/insights/UsageExplorer'
import type { PinnedWidget } from '@/domain/widgetInstances'

function PinScope({ pin, children }: { pin: PinnedWidget; children: ReactNode }) {
  const { notify } = useWorkspace()
  const update = (taskFilters: PinnedWidget['viewState']['taskFilters']) => {
    const result = pinService.updatePinViewState(pin.pinId, { taskFilters })
    if (!result.ok) notify(result.message)
    else if (result.persistence.status !== 'saved') notify('Pin filters updated for this session. Device storage is unavailable.')
  }
  const composition = { widgets: [pin.explanation] }
  const binding = pin.binding
  if (binding.kind === 'meeting') return <MeetingScopeProvider session={{ meetingId: binding.meetingId, taskFilters: pin.viewState.taskFilters, composition, ownership: binding }} onFilters={update}>{children}</MeetingScopeProvider>
  if (binding.kind === 'usage') return <UsageScopeProvider session={{ intent: binding.intent, taskFilters: pin.viewState.taskFilters, snapshotFingerprint: pin.fingerprint, composition }} onFilters={update}>{children}</UsageScopeProvider>
  if (binding.kind === 'overdue') return <OverdueScopeProvider session={{ intent: binding.intent, referenceDate: binding.referenceDate, filters: pin.viewState.taskFilters, composition }} onFilters={update}>{children}</OverdueScopeProvider>
  return children
}
function PinnedCard({ pin }: { pin: PinnedWidget }) {
  const workspace = useWorkspace()
  const preferences = useDisplayPreferences()
  const store = useMemo(() => createRecordStore(browserDatabase, () => loadPinnedRecords(browserDatabase, pin)), [pin])
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const update = (patch: Partial<PinnedWidget['viewState']>) => {
    const result = pinService.updatePinViewState(pin.pinId, patch)
    if (!result.ok) workspace.notify(result.message)
    else if (result.persistence.status !== 'saved') workspace.notify('Pin updated for this session. Device storage is unavailable.')
  }
  const Widget = registry[pin.widgetType].component
  const frame = <WidgetFrame id={pin.widgetType} instance={pin} recordsChanged={records.status === 'found' && records.value.fingerprint !== pin.fingerprint}>{records.status !== 'found' ? <p className="text-sm text-muted-foreground" role="alert">This pin’s records are unavailable. Restore the records or unpin this view.</p> : pin.binding.kind === 'usage-query' ? <DataUsageExplorer boundQuery={pin.binding.query} /> : <Widget />}</WidgetFrame>
  return <div className={`workspace-cell span-${pin.span}`} data-pin-id={pin.pinId}><p className="mb-2 text-xs text-muted-foreground">Pinned · {records.status === 'found' ? records.value.label : pin.label}</p><UnscopedWidget><WorkspaceViewProvider overrides={{ state: { ...workspace.state, filters: pin.viewState.taskFilters }, updateFilters: patch => update({ taskFilters: { ...pin.viewState.taskFilters, ...patch } }), selectedDate: pin.viewState.selectedDate ?? workspace.selectedDate, selectDate: date => update({ selectedDate: date }) }}><DisplayPreferencesContext.Provider value={{ preferences: { taskView: preferences.taskView, calendarView: pin.viewState.calendarView ?? preferences.calendarView, calendarCategory: pin.viewState.calendarCategory ?? preferences.calendarCategory }, update: patch => { if (patch.taskView) preferences.setTaskView(patch.taskView); const { taskView: _taskView, ...calendar } = patch; if (Object.keys(calendar).length) update(calendar) } }}>{records.status === 'found' ? <PinScope pin={pin}>{frame}</PinScope> : frame}</DisplayPreferencesContext.Provider></WorkspaceViewProvider></UnscopedWidget></div>
}
export function PinnedWidgets() {
  const pins = usePinnedWidgets()
  if (pins.status !== 'found') return <p className="mt-4 text-sm text-muted-foreground" role="alert">Saved pins are unavailable and have been preserved. Use Clear pins in workspace options to start again.</p>
  if (!pins.value.length) return null
  return <section className="pinned-workspace mt-6" aria-label="Pinned views"><div className="workspace-grid">{pins.value.map(pin => <PinnedCard key={pin.pinId} pin={pin} />)}</div></section>
}
