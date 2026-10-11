import { useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { browserDatabase } from '@/services'
import { workspaceDocumentStore } from '@/services/workspaceDocumentStore'

export function useWorkspaceDocument() {
  const store = useMemo(() => workspaceDocumentStore(browserDatabase), [])
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const current = useRef(snapshot.document)
  useLayoutEffect(() => { current.current = snapshot.document }, [snapshot.document])
  return {
    document: snapshot.document, current, notice: snapshot.notice,
    setNotice: store.setNotice,
    save: (next: typeof snapshot.document, remember = true) => { if (!store.save(next, remember)) return false; current.current = store.getSnapshot().document; return true },
    interrupt: store.interrupt, canUndo: !!snapshot.undo.length, undo: store.undo, clearUndo: store.clearUndo,
  }
}
