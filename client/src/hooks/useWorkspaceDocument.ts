import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { browserDatabase } from '@/services'
import { createWorkspaceDocumentService } from '@/services/workspaceDocumentService'
import { createRecordStore } from '@/services/preparationStore'
import { commitWorkspace, type WorkspaceDocument } from '@/domain/workspaceDocument'

export function useWorkspaceDocument() {
  const service = useMemo(() => createWorkspaceDocumentService(browserDatabase), [])
  const [initial] = useState(() => service.initialize())
  const [notice, setNotice] = useState(initial.notice)
  const [fallback, setFallback] = useState(initial.document)
  const store = useMemo(() => createRecordStore(browserDatabase, service.load), [service])
  const loaded = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const document = loaded.status === 'found' ? loaded.value : fallback
  const current = useRef(document)
  const [undo, setUndo] = useState<Pick<WorkspaceDocument, 'active' | 'pins' | 'targets'>[]>([])
  useLayoutEffect(() => {
    if (current.current.revision !== document.revision) {
      const previous = { active: current.current.active, pins: current.current.pins, targets: current.current.targets }
      setUndo(history => [...history, previous].slice(-20))
    }
    current.current = document
  }, [document])
  function save(next: WorkspaceDocument, remember = true) {
    const previous = { active: current.current.active, pins: current.current.pins, targets: current.current.targets }
    const result = service.save(next)
    if (result.status === 'invalid') { setNotice('Saved workspace could not be updated. Existing storage has been preserved.'); return false }
    if (remember) setUndo(history => [...history, previous].slice(-20))
    setFallback(next); current.current = next
    setNotice(result.status === 'saved' ? '' : 'Changes are kept for this session. Device storage is unavailable.')
    return true
  }
  return { document, current, notice, setNotice, save, canUndo: !!undo.length, undo: () => {
    const previous = undo.at(-1)
    if (previous && save(commitWorkspace(current.current, previous), false)) setUndo(history => history.slice(0, -1))
  }, clearUndo: () => setUndo([]) }
}
