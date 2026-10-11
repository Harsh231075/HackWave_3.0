import type { BrowserDatabase } from './browserDatabase.ts'
import { createWorkspaceDocumentService } from './workspaceDocumentService.ts'
import { commitWorkspace, type WorkspaceDocument } from '../domain/workspaceDocument.ts'

type History = Pick<WorkspaceDocument, 'active' | 'pins' | 'targets' | 'continuation'>
export function createWorkspaceDocumentStore(database: BrowserDatabase) {
  const service = createWorkspaceDocumentService(database)
  let snapshot: { document: WorkspaceDocument; notice: string; undo: History[] } | undefined
  const listeners = new Set<() => void>()
  let writing = false
  let epoch = database.getEpoch()
  const getSnapshot = () => {
    if (!snapshot) { const initial = service.initialize(); snapshot = { document: initial.document, notice: initial.notice, undo: [] } }
    return snapshot
  }
  const emit = () => { for (const listener of listeners) listener() }
  const history = (document: WorkspaceDocument): History => ({ active: document.active, pins: document.pins, targets: document.targets, continuation: document.continuation ? { lastSuccess: document.continuation.lastSuccess } : undefined })
  database.subscribe(() => {
    if (writing) return
    if (epoch !== database.getEpoch()) { epoch = database.getEpoch(); snapshot = undefined; getSnapshot(); emit(); return }
    const loaded = service.load()
    if (loaded.status !== 'found') return
    const previous = getSnapshot()
    if (JSON.stringify(previous.document) === JSON.stringify(loaded.value)) return
    snapshot = { ...previous, document: loaded.value }
    emit()
  })
  function save(document: WorkspaceDocument, remember = true) {
    const previous = getSnapshot()
    writing = true
    const result = service.save(document)
    writing = false
    if (result.status === 'invalid') { setNotice('Saved workspace could not be updated. Existing storage has been preserved.'); return false }
    snapshot = { document, notice: result.status === 'saved' ? '' : 'Changes are kept for this session. Device storage is unavailable.', undo: remember ? [...previous.undo, history(previous.document)].slice(-20) : previous.undo }
    emit()
    return true
  }
  function setNotice(notice: string) { const previous = getSnapshot(); if (notice !== previous.notice) { snapshot = { ...previous, notice }; emit() } }
  return {
    getSnapshot, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    save, setNotice,
    interrupt: (id: string) => {
      const document = getSnapshot().document
      if (document.turns.some(turn => turn.id === id && turn.status === 'pending')) save({ ...document, turns: document.turns.map(turn => turn.id === id ? { ...turn, status: 'cancelled', reply: 'This request was interrupted. Send it again to continue.' } : turn) }, false)
    },
    undo: () => { const previous = getSnapshot(), last = previous.undo.at(-1); if (last && save(commitWorkspace(previous.document, last), false)) { snapshot = { ...getSnapshot(), undo: previous.undo.slice(0, -1) }; emit() } },
    clearUndo: () => { snapshot = { ...getSnapshot(), undo: [] }; emit() },
  }
}
const stores = new WeakMap<BrowserDatabase, ReturnType<typeof createWorkspaceDocumentStore>>()
export function workspaceDocumentStore(database: BrowserDatabase) {
  let store = stores.get(database)
  if (!store) { store = createWorkspaceDocumentStore(database); stores.set(database, store) }
  return store
}
