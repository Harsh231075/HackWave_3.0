import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import type { Preparation } from '../domain/adaptiveData.ts'

/** Stable snapshots for both domain edits and collection-only notifications. */
export function createRecordStore<T>(database: BrowserDatabase, load: () => LoadResult<T>) {
  let snapshot: LoadResult<T> | undefined
  const getSnapshot = () => snapshot ??= load()
  const subscribe = (listener: () => void) => {
    // Refresh after a period without subscribers as collections may have changed.
    snapshot = load()
    return database.subscribe(() => { snapshot = load(); listener() })
  }
  return { getSnapshot, subscribe }
}

export const createPreparationStore = (database: BrowserDatabase, load: (id: string) => LoadResult<Preparation>, id: string) => createRecordStore(database, () => load(id))
