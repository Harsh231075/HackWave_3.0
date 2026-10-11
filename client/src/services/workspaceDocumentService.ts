import { emptyWorkspace, workspaceCollectionKey, workspaceDocumentSchema, type WorkspaceDocument } from '../domain/workspaceDocument.ts'
import { makeInstance, type WidgetBinding, type WidgetInstance } from '../domain/widgetInstances.ts'
import { PRESETS } from '../lib/workspace/config.ts'
import { meetingLayoutSchema, usageLayoutSchema, overdueLayoutSchema } from './layoutService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult, SaveResult } from './contracts.ts'

export { makeInstance } from '../domain/widgetInstances.ts'
export function instancesFromLayout(value: unknown, id: () => string = () => crypto.randomUUID()): WidgetInstance[] {
  const meeting = meetingLayoutSchema.safeParse(value), usage = usageLayoutSchema.safeParse(value), overdue = overdueLayoutSchema.safeParse(value)
  const layout = meeting.success ? meeting.data : usage.success ? usage.data : overdue.success ? overdue.data : null
  if (!layout) return []
  const binding: WidgetBinding = meeting.success ? { kind: 'meeting', meetingId: meeting.data.meetingId,  } : usage.success ? { kind: 'usage', intent: usage.data.intent } : { kind: 'overdue', intent: overdue.data!.intent, referenceDate: overdue.data!.referenceDate }
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
    const document=emptyWorkspace()
    if(existing.status==='invalid')return {document,notice:'Saved layout is invalid. Reset local data to recover.',persistence:{status:'invalid'}}
    document.active=PRESETS.home.widgets.map(w=>({...makeInstance(w.id),span:w.span}))
    const persistence=save(document)
    initial={document,persistence,notice:persistence.status==='saved'?'':'Layout is available for this session only.'}
    return initial
  }
  return { load, save, initialize }
}
