import { emptyWorkspace, workspaceCollectionKey, workspaceDocumentSchema, type WorkspaceDocument } from '../domain/workspaceDocument.ts'
import { makeInstance, widgetInstanceSchema, widgetSelectionKey, pinnedWidgetSchema, type WidgetBinding, type WidgetInstance, type WidgetViewState } from '../domain/widgetInstances.ts'
import { widgetTypes, PRESETS, type WidgetType } from '../lib/workspace/config.ts'
import { meetingLayoutSchema, usageLayoutSchema, overdueLayoutSchema } from './layoutService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult, SaveResult } from './contracts.ts'

export { makeInstance } from '../domain/widgetInstances.ts'
export function instancesFromLayout(value: unknown, id: () => string = () => crypto.randomUUID()): WidgetInstance[] {
  const meeting = meetingLayoutSchema.safeParse(value), usage = usageLayoutSchema.safeParse(value), overdue = overdueLayoutSchema.safeParse(value)
  const layout = meeting.success ? meeting.data : usage.success ? usage.data : overdue.success ? overdue.data : null
  if (!layout) return []
  const binding: WidgetBinding = meeting.success ? { kind: 'meeting', meetingId: meeting.data.meetingId, clientId: meeting.data.intent.clientId!, projectId: meeting.data.intent.projectId! } : usage.success ? { kind: 'usage', intent: usage.data.intent } : { kind: 'overdue', intent: overdue.data!.intent, referenceDate: overdue.data!.referenceDate }
  return layout.composition.widgets.map((widget, index) => ({ ...makeInstance(widget.type, binding, { taskFilters: overdue.success ? overdue.data.filters : meeting.success ? meeting.data.taskFilters : usage.data!.taskFilters }, id()), span: widget.span, ...(index === 0 && layout.composition.actions ? { actions: layout.composition.actions } : {}), explanation: { type: widget.type, reason: widget.reason, evidence: widget.evidence }, fingerprint: usage.success ? usage.data.snapshotFingerprint : '' }))
}
const initializedDatabases=new WeakSet<BrowserDatabase>()
export function createWorkspaceDocumentService(database: BrowserDatabase) {
  const load = (): LoadResult<WorkspaceDocument> => {
    const loaded = database.readCollection(workspaceCollectionKey)
    if (loaded.status !== 'found') return loaded
    const parsed = workspaceDocumentSchema.safeParse(loaded.value)
    return parsed.success ? { status: 'found', value: parsed.data } : { status: 'invalid' }
  }
  const save = (document: WorkspaceDocument): SaveResult => {
    const parsed = workspaceDocumentSchema.safeParse(document)
    return parsed.success ? database.writeCollection(workspaceCollectionKey, parsed.data) : { status: 'invalid' }
  }
  let initial: { document: WorkspaceDocument; notice: string; persistence: SaveResult } | undefined
  function initialize(): { document: WorkspaceDocument; notice: string; persistence: SaveResult } {
    const firstLoad=!initializedDatabases.has(database)
    initializedDatabases.add(database)
    const existing = load()
    if (initial && existing.status === 'missing') return initial
    if (existing.status === 'found') {
      // Route remounts preserve live requests; fresh loads retain resumable clarifications.
      const interrupted = firstLoad && existing.value.turns.some(turn => turn.status === 'pending' || (turn.status === 'clarification' && !existing.value.continuation?.pending))
      if (!interrupted) return { document: existing.value, notice: '', persistence: database.getPersistenceResult() }
      const document = { ...existing.value, turns: existing.value.turns.map(turn => turn.status === 'pending' ? { ...turn, status: 'cancelled' as const, reply: 'This request was interrupted. Send it again to continue.' } : turn.status === 'clarification' && !existing.value.continuation?.pending ? { ...turn, status: 'cancelled' as const, reply: 'This question was interrupted. Send it again to continue.' } : turn) }
      return { document, notice: '', persistence: save(document) }
    }
    let document = emptyWorkspace(), skipped = 0
    if (existing.status === 'invalid') return { document, notice: 'Saved workspace is invalid and has been preserved. Reset the workspace to start again.', persistence: { status: 'invalid' } }
    const read = (key: string) => { const result = database.storage.readJson(key); if (result.status === 'invalid') skipped++; return result.status === 'found' ? result.value : null }
    const rawManaged = read('orlo-continuous-workspace-v1')
    const legacy = read('gogpt-app-layout-v1') as { response?: string } | null
    if (Array.isArray(rawManaged)) {
      for (const raw of rawManaged) {
        try {
          const item = raw as { id: WidgetType; span: WidgetInstance['span']; plan?: { bindings?: Record<string, unknown>; referenceDate?: string; timezone?: string }; meeting?: unknown; usage?: unknown; overdue?: unknown; live?: { accountId?: string; eventId?: string; kind: 'prepare' | 'schedule'; goal: string; date: string } }
          const scoped = instancesFromLayout(item.meeting ?? item.usage ?? item.overdue).find(w => w.widgetType === item.id)
          const bindings = item.plan?.bindings ?? {}
          const { projectId, clientId, draftKey, category, ...state } = bindings
          const binding: WidgetBinding = item.live?.accountId ? { kind: 'google-calendar', calendarId: 'primary', accountId: item.live.accountId, eventId: item.live.eventId, mode: item.live.kind } : scoped?.binding ?? { kind: 'workspace', projectId: projectId as string | undefined, clientId: clientId as string | undefined, draftKey: draftKey as string | undefined }
          const filters = state.taskFilters as Record<string, unknown> | undefined
          if (filters?.status === 'open') { state.taskFilters = { ...filters, status: 'all' }; state.taskStatuses = ['pending', 'blocked'] }
          const instance = makeInstance(item.id, binding, { ...scoped?.viewState, ...state, calendarCategory: category as WidgetViewState['calendarCategory'], referenceDate: item.plan?.referenceDate, timezone: item.plan?.timezone, ...(item.live ? { goal: item.live.goal, selectedDate: item.live.date } : {}) })
          document.active.push(widgetInstanceSchema.parse({ ...instance, span: item.span }))
        } catch { skipped++ }
      }
    } else if (legacy) {
      document.active = instancesFromLayout(legacy)
      // Old general layouts stored literal OpenUI calls. This reader runs only during migration.
      if (!document.active.length && typeof legacy.response === 'string') {
        for (const match of legacy.response.matchAll(/WorkspaceWidget\(\s*"([a-z-]+)"\s*,\s*"(full|wide|narrow)"\s*\)/g)) {
          if (widgetTypes.includes(match[1] as WidgetType)) document.active.push({ ...makeInstance(match[1] as WidgetType), span: match[2] as WidgetInstance['span'] })
        }
      }
    } else document.active = PRESETS.home.widgets.map(w => ({ ...makeInstance(w.id), span: w.span }))
    const oldPins = database.readCollection('workspacePins')
    if (oldPins.status === 'found' && oldPins.value && typeof oldPins.value === 'object' && 'pins' in oldPins.value && Array.isArray(oldPins.value.pins)) {
      for (const value of oldPins.value.pins) {
        const parsed = pinnedWidgetSchema.safeParse(value)
        if (parsed.success && document.pins.length < 6) document.pins.push(parsed.data); else skipped++
      }
    }
    for (const type of ((read('gogpt-workspace-v1') as { pins?: string[] } | null)?.pins ?? [])) {
      if (!widgetTypes.includes(type as WidgetType) || document.pins.some(p => p.widgetType === type)) continue
      const instance = document.active.find(w => w.widgetType === type) ?? makeInstance(type as WidgetType)
      if (document.pins.length < 6) document.pins.push({ ...instance, pinId: crypto.randomUUID(), createdAt: new Date().toISOString() })
    }
    const seen = new Set<string>()
    document.active = document.active.filter(w => {
      const selection = widgetSelectionKey(w)
      if (document.pins.some(p => p.instanceId === w.instanceId || widgetSelectionKey(p) === selection)) return false
      if (seen.has(selection)) { skipped++; return false }
      seen.add(selection); return true
    })
    if (!Array.isArray(rawManaged)) {
      const live = read('orlo-live-calendar-layout-v1') as { accountId?: string; eventId?: string; kind?: 'prepare' | 'schedule'; goal?: string; date?: string } | null
      if (live?.accountId && live.kind) {
        try { document.active.push(makeInstance('meetings', { kind: 'google-calendar', calendarId: 'primary', accountId: live.accountId, eventId: live.eventId, mode: live.kind }, { goal: live.goal, selectedDate: live.date })) } catch { skipped++ }
      }
    }
    const history = read('orlo-workspace-conversation-v1') as { turns?: unknown[] } | null
    if (Array.isArray(history?.turns)) {
      for (const raw of history.turns.slice(-60)) {
        if (!raw || typeof raw !== 'object') { skipped++; continue }
        const { id, prompt, reply, status } = raw as Record<string, unknown>
        const parsed = workspaceDocumentSchema.shape.turns.element.safeParse({ id, prompt, reply, status: status === 'pending' || status === 'clarification' ? 'cancelled' : status })
        if (parsed.success) document.turns.push(parsed.data); else skipped++
      }
    }
    while (document.active.length + document.pins.length > 14) { document.active.pop(); skipped++ }
    const parsed = workspaceDocumentSchema.safeParse(document)
    if (!parsed.success) return { document: emptyWorkspace(), notice: 'Legacy workspace could not be migrated and has been preserved.', persistence: { status: 'invalid' } }
    document = parsed.data
    const persistence: SaveResult = database.storage.readJson('orlo-browser-db-v1').status === 'unavailable' ? { status: 'unavailable' } : { status: 'saved' }
    initial = { document, persistence, notice: persistence.status !== 'saved' ? 'Workspace restored for this session. Device storage is unavailable.' : skipped ? `${skipped} invalid or excess saved entries were skipped. Original storage has been preserved.` : '' }
    return initial
  }
  return { load, save, initialize }
}
