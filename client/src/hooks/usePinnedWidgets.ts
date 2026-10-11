import { useMemo, useSyncExternalStore } from 'react'
import { browserDatabase, pinService } from '@/services'
import { createRecordStore } from '@/services/preparationStore'
export function usePinnedWidgets() {
  // Services import the renderer specification; defer database access until render.
  const store = useMemo(() => createRecordStore(browserDatabase, pinService.loadPins), [])
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}
