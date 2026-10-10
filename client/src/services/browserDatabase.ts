import { workspaceReducer, emptyFilters, type Action } from '../domain/workspace.ts'
import type { DomainSnapshot, WorkspaceState } from '../domain/types.ts'
import { z } from 'zod'
import type { LoadResult, SaveResult, StorageAdapter } from './contracts.ts'
import { createWorkspaceService, persistedSchema } from './workspaceService.ts'

export interface BrowserDatabase {
  storage: StorageAdapter
  getState(): WorkspaceState
  subscribe(listener: () => void): () => void
  dispatch(action: Action): void
  readCollection(key: string): LoadResult<unknown>
  writeCollection(key: string, value: unknown): SaveResult
  replaceRecords(snapshot: DomainSnapshot): SaveResult
  reset(): void
  getPersistenceResult(): SaveResult
}

// One in-memory state and one persistence writer for all task/event/draft services.
// Initialization is lazy so importing services never reads browser storage.
export function createBrowserDatabase(storage: StorageAdapter, seed: DomainSnapshot, seedCollections: Record<string, unknown> = {}): BrowserDatabase {
  const repository = createWorkspaceService(storage)
  let state: WorkspaceState | undefined
  let persistence: SaveResult = { status: 'saved' }
  const collectionSchema = z.object({ version: z.literal(1), collections: z.record(z.string(), z.unknown()) })
  let collections: Record<string, unknown> | undefined
  const loadCollections = (): LoadResult<Record<string, unknown>> => {
    if (collections) return { status: 'found', value: collections }
    const loaded = storage.readJson('orlo-browser-db-v1')
    if (loaded.status === 'missing') { collections = structuredClone(seedCollections); return { status: 'found', value: collections } }
    if (loaded.status === 'unavailable') { collections = structuredClone(seedCollections); return { status: 'found', value: collections } }
    if (loaded.status !== 'found') return loaded
    const result = collectionSchema.safeParse(loaded.value)
    if (!result.success) return { status: 'invalid' }
    collections = { ...structuredClone(seedCollections), ...result.data.collections }
    return { status: 'found', value: collections }
  }
  const listeners = new Set<() => void>()
  const initial = (): WorkspaceState => ({ ...structuredClone(seed), filters: emptyFilters(), pins: [], history: [] })
  const getState = () => {
    if (!state) {
      const result = repository.load()
      state = result.status === 'found' ? { ...initial(), ...result.value } : initial()
    }
    return state
  }
  const dispatch = (action: Action) => {
    const previous = getState()
    const next = workspaceReducer(previous, action)
    if (next === previous) return
    state = next
    if (action.type !== 'filters' && action.type !== 'pin') persistence = repository.save(next)
    for (const listener of listeners) listener()
  }
  return {
    storage, getState, dispatch,
    readCollection(key) {
      const loaded = loadCollections()
      if (loaded.status !== 'found') return loaded
      return Object.hasOwn(loaded.value, key) ? { status: 'found', value: structuredClone(loaded.value[key]) } : { status: 'missing' }
    },
    writeCollection(key, value) {
      const loaded = loadCollections()
      if (loaded.status === 'invalid') return { status: 'invalid' }
      // Storage may be blocked; preserve local operations in memory for this session.
      collections = { ...(loaded.status === 'found' ? loaded.value : collections ?? {}), [key]: structuredClone(value) }
      persistence = storage.writeJson('orlo-browser-db-v1', { version: 1, collections })
      for (const listener of listeners) listener()
      return persistence
    },
    subscribe(listener) { listeners.add(listener); return () => { listeners.delete(listener) } },
    replaceRecords(snapshot) {
      const parsed = persistedSchema.safeParse(snapshot)
      if (!parsed.success) return { status: 'invalid' }
      dispatch({ type: 'reset', state: { ...getState(), ...parsed.data } })
      return persistence
    },
    reset: () => dispatch({ type: 'reset', state: initial() }),
    getPersistenceResult: () => persistence,
  }
}
