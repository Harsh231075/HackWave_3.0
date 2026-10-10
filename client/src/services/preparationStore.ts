import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import type { Preparation } from '../domain/adaptiveData.ts'

/** Stable snapshots for both domain edits and collection-only notifications. */
export function createPreparationStore(database: BrowserDatabase, load: (meetingId: string) => LoadResult<Preparation>, meetingId: string) {
  let snapshot: LoadResult<Preparation> | undefined
  const getSnapshot = () => snapshot ??= load(meetingId)
  const subscribe = (listener: () => void) => {
    // Refresh after a period without subscribers as collections may have changed.
    snapshot = load(meetingId)
    return database.subscribe(() => { snapshot = load(meetingId); listener() })
  }
  return { getSnapshot, subscribe }
}
