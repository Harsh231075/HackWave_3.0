import { DisabledExtension } from '@/extensions/DisabledExtension'
import { isExtension } from '@/extensions/catalog'
import { extensionService, pluginImportService } from '@/services'
import { GeneratedActionButtons } from './GeneratedActionButtons'
import { useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { browserDatabase, workspaceActionService } from '@/services'
import { createRecordStore } from '@/services/preparationStore'
import { loadPinnedRecords } from '@/services/pinnedRecords'
import { loadActionScope } from '@/services/actionScope'
import { registry } from './registry'
import type { WidgetType } from './config'
import { WidgetFrame } from './WorkspaceRenderer'
import { WorkspaceViewProvider, useWorkspace } from '@/state/WorkspaceProvider'
import { MeetingScopeProvider, UnscopedWidget } from '@/state/MeetingScope'
import { UsageScopeProvider } from '@/state/UsageScope'
import { OverdueScopeProvider } from '@/state/OverdueScope'
import { ComponentViewProvider } from '@/state/ComponentViewProvider'
import { DisplayPreferencesContext } from '@/state/displayPreferencesContext'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { componentViewSchema, type ViewBindings } from '@/domain/componentIntent'
import { calendarDate } from '@/domain/calendar'
import type { PinnedWidget, WidgetInstance, WidgetViewState } from '@/domain/widgetInstances'
import { GoogleBoundWidget } from '@/components/calendar/GoogleBoundWidget'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'
import { DataUsageExplorer } from '@/components/insights/UsageExplorer'
import { WorkspaceActionContext } from './WorkspaceActionContext'

function InstanceHost({ instance, update, children }: { instance: WidgetInstance; update: (patch: Partial<WidgetViewState>) => void; children: ReactNode }) {
  const workspace = useWorkspace()
  const preferences = useDisplayPreferences()
  const binding = instance.binding, view = instance.viewState
  const date = view.referenceDate ?? (binding.kind === 'overdue' ? binding.referenceDate : calendarDate())
  const scopeIds = binding.kind === 'workspace' || binding.kind === 'meeting' ? { clientId: binding.clientId, projectId: binding.projectId } : binding.kind === 'usage' || binding.kind === 'overdue' ? { clientId: binding.intent.clientId, projectId: binding.intent.projectId } : {}
  const plan = componentViewSchema.parse({ action: 'view', widgets: [instance.widgetType], bindings: { ...view, ...scopeIds, ...(binding.kind === 'workspace' ? { clientId: binding.clientId, projectId: binding.projectId, draftKey: binding.draftKey } : {}), category: view.calendarCategory }, referenceDate: date, timezone: view.timezone ?? 'Asia/Kolkata', reply: 'Instance view' })
  const change = (patch: Partial<ViewBindings>) => { const { category, clientId: _client, projectId: _project, draftKey: _draft, ...state } = patch; update({ ...state, ...(category !== undefined ? { calendarCategory: category } : {}) }) }
  const composition = { widgets: [instance.explanation] }
  let scoped = children
  const filters = (taskFilters: WidgetViewState['taskFilters']) => update({ taskFilters, taskStatuses: undefined })
  if (binding.kind === 'meeting') scoped = <MeetingScopeProvider session={{ meetingId: binding.meetingId, ownership: binding, taskFilters: view.taskFilters, composition }} onFilters={filters}>{children}</MeetingScopeProvider>
  if (binding.kind === 'usage') scoped = <UsageScopeProvider session={{ intent: binding.intent, taskFilters: view.taskFilters, snapshotFingerprint: instance.fingerprint, composition }} onFilters={filters}>{children}</UsageScopeProvider>
  if (binding.kind === 'overdue') scoped = <OverdueScopeProvider session={{ intent: binding.intent, filters: view.taskFilters, referenceDate: binding.referenceDate, composition }} onFilters={filters}>{children}</OverdueScopeProvider>
  const actions = useContext(WorkspaceActionContext)
  const origin = { binding, instanceId: instance.instanceId.startsWith('preset:') ? undefined : instance.instanceId, pinId: 'pinId' in instance ? String(instance.pinId) : undefined, revision: actions?.revision ?? 0, referenceDate: date }
  return <UnscopedWidget><WorkspaceViewProvider overrides={{
    selectedDate: view.selectedDate ?? workspace.selectedDate, selectDate: selectedDate => update({ selectedDate, dateRange: undefined }),
    updateFilters: patch => filters({ ...view.taskFilters, ...patch }),
    toggleTask: id => {
      const expected = workspace.state.tasks.find(t => t.id === id)
      if (!expected || !workspaceActionService.checkTask(origin, expected).ok) return { ok: false, message: 'This task left the original view.' }
      return workspace.toggleTask(id)
    },
    deleteTask: id => {
      const expected=workspace.state.tasks.find(t=>t.id===id)
      if(!expected||!workspaceActionService.checkTask(origin,expected).ok)return {ok:false,message:'This task left the original view.'}
      return workspace.deleteTask(id)
    },
    saveTask: input => {
      if (!input.id) return binding.kind === 'workspace' && !binding.projectId && !binding.clientId ? workspace.saveTask(input) : { ok: false, message: 'Create tasks in the unscoped Tasks view.' }
      const prepared = workspaceActionService.prepare({ type: 'task.edit', taskId: input.id }, origin)
      return prepared.ok && prepared.value.type === 'task.edit' ? workspaceActionService.saveTask(prepared.value, input) : { ok: false, message: 'This task left the original view.' }
    },
    saveDraft: (key, value) => {
      const prepared = workspaceActionService.prepare({ type: 'draft.edit' }, origin)
      if (!prepared.ok || prepared.value.type !== 'draft.edit' || prepared.value.key !== key) return { ok: false, message: 'This draft left the original view.' }
      return workspaceActionService.saveDraft(prepared.value, value)
    },
  }}><DisplayPreferencesContext.Provider value={{ preferences: { taskView: view.taskView ?? preferences.taskView, calendarView: view.calendarView ?? preferences.calendarView, calendarCategory: view.calendarCategory ?? preferences.calendarCategory }, update: patch => update(patch) }}><ComponentViewProvider plan={plan} onChange={change}>{scoped}</ComponentViewProvider></DisplayPreferencesContext.Provider></WorkspaceViewProvider></UnscopedWidget>
}

function InstanceCard({ instance, update, remove, pageActions = false }: { remove?:(id:string)=>void; pageActions?: boolean; instance: WidgetInstance | PinnedWidget; update: (instance: WidgetInstance | PinnedWidget) => void }) {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const calendar = useGoogleCalendar()
  const store = useMemo(() => createRecordStore(browserDatabase, () => loadPinnedRecords(browserDatabase, instance)), [instance])
  const records = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const Widget = registry[instance.widgetType].component
  let content: ReactNode = instance.binding.kind === 'usage-query' ? <DataUsageExplorer boundQuery={instance.binding.query} /> : <Widget key={isExtension(instance.widgetType)?JSON.stringify([instance.binding,instance.viewState.timerDurationMinutes,instance.viewState.selectedTaskId,instance.viewState.externalPluginId]):undefined} />
  if (instance.binding.kind === 'google-calendar') content = calendar.connection?.connected && calendar.connection.accountId === instance.binding.accountId ? <GoogleBoundWidget instance={instance} update={update} /> : <div className="space-y-3"><p>This view belongs to its original Google account. Connect that account to continue.</p><GoogleCalendarConnection /></div>
  if (records.status !== 'found' || !loadActionScope(browserDatabase, instance.binding)) content = <p role="alert">This view’s original records are unavailable. Restore them or remove this view.</p>
  if (isExtension(instance.widgetType) && (!extensionService.isWidgetEnabled(instance.widgetType) || instance.widgetType==='external-plugin' && !!instance.viewState.externalPluginId && !pluginImportService.getById(instance.viewState.externalPluginId)?.enabled)) content = <DisabledExtension id={instance.widgetType} remove={remove?()=>remove(instance.instanceId):undefined} />
  const label = records.status === 'found' ? records.value.label === instance.widgetType ? '' : records.value.label : instance.binding.kind === 'workspace' && !instance.binding.clientId && !instance.binding.projectId ? '' : instance.label
  return <div className={`workspace-cell span-${instance.span}`} data-workspace-component={instance.widgetType} data-instance-id={instance.instanceId}>
    <p className="mb-2 text-xs text-muted-foreground" hidden={!label && !('pinId' in instance)}>{'pinId' in instance ? label ? 'Pinned · ' : 'Pinned' : ''}{label}</p>
    <InstanceHost instance={instance} update={patch => update({ ...instance, viewState: { ...instance.viewState, ...patch } })}>
      <WidgetFrame id={instance.widgetType} pageActions={pageActions} instance={instance} recordsChanged={records.status === 'found' && !!instance.fingerprint && records.value.fingerprint !== instance.fingerprint}>{content}{extensionService.isWidgetEnabled(instance.widgetType) && instance.actions && (instance.binding.kind !== 'google-calendar' || calendar.connection?.connected && calendar.connection.accountId === instance.binding.accountId) && <GeneratedActionButtons buttons={instance.actions} />}</WidgetFrame>
    </InstanceHost>
  </div>
}
export function InstanceCanvas({ instances, update, remove, pageActionWidget }: { remove?:(id:string)=>void; pageActionWidget?: WidgetType; instances: Array<WidgetInstance | PinnedWidget>; update: (instance: WidgetInstance | PinnedWidget) => void }) {
  return <div className="workspace-grid">{instances.map(instance => <InstanceCard key={instance.instanceId} instance={instance} update={update} remove={remove} pageActions={instance.widgetType === pageActionWidget} />)}</div>
}
