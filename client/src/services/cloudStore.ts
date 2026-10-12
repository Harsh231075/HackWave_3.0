import { createBrowserDatabase } from './browserDatabase.ts'
import { createMemoryStorage } from './memoryStorage.ts'
import { setApiBeforeRequest, createHttpClient } from './api/httpClient.ts'
import { emptyRecords, freshLocalData } from './localDataService.ts'
import type { DomainSnapshot } from '../domain/types.ts'
import type { Action } from '../domain/workspace.ts'

type Snapshot = { revision: number; records: DomainSnapshot; collections: Record<string, unknown>; preferences: Record<string, string> }
type Status = { status: 'signed-out' | 'loading' | 'ready' | 'error'; pending: number; message: string }
const memory = createMemoryStorage()
export const dataStore = createBrowserDatabase(memory.storage, emptyRecords(), freshLocalData())
const hydrate = dataStore.hydrate, dispatch = dataStore.dispatch, writeCollection = dataStore.writeCollection
const overlays = new Map<string, { sequence: number; value: unknown }>()
let overlaySequence = 0
let sessionController = new AbortController()
let userId = '', generation = 0, revision = 0, queue: Promise<unknown> = Promise.resolve()
let status: Status = { status: 'signed-out', pending: 0, message: '' }
const listeners = new Set<() => void>()
const set = (patch: Partial<Status>) => { status = { ...status, ...patch }; for (const listener of listeners) listener() }
function install(snapshot: Snapshot, newSession = false) {
  revision = snapshot.revision
  for (const [key, value] of Object.entries(snapshot.preferences)) memory.storage.writeString(key, value)
  const collections = { ...snapshot.collections }
  for (const [key, overlay] of overlays) collections[key] = overlay.value
  hydrate(snapshot.records, collections, newSession)
}
const request = (url: string, options?: RequestInit) => createHttpClient().requestJson(url, { ...options, signal: options?.signal ?? sessionController.signal })
export const cloudStore = {
  isCurrent: (id: string) => userId === id,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
  getSnapshot: () => status,
  async initialize(id: string) {
    if (userId === id && status.status === 'ready') return
    sessionController.abort(); sessionController = new AbortController(); overlays.clear()
    const epoch = ++generation
    userId = id; queue = Promise.resolve(); memory.clear(); hydrate(emptyRecords(), freshLocalData(), true)
    set({ status: 'loading', message: '', pending: 0 })
    try {
      const snapshot = await request('/api/data') as Snapshot
      if (epoch !== generation) return
      install(snapshot); set({ status: 'ready' })
    } catch (error) { if (epoch === generation) set({ status: 'error', message: error instanceof Error ? error.message : 'Unable to load your data.' }) }
  },
  clear() {
    sessionController.abort(); sessionController = new AbortController(); overlays.clear()
    generation++; userId = ''; revision = 0; queue = Promise.resolve(); memory.clear()
    hydrate(emptyRecords(), freshLocalData(), true); set({ status: 'signed-out', pending: 0, message: '' })
  },
  mutate(service: string, method: string, args: unknown[]): Promise<unknown> {
    if (!userId || status.status !== 'ready') return Promise.resolve({ ok: false, message: 'Sign in and load your records first.' })
    const epoch = generation
    set({ pending: status.pending + 1, message: '' })
    const result = queue.catch(() => {}).then(async () => {
      if (epoch !== generation) return { ok: false, message: 'Account changed. This operation was cancelled.' }
      try {
        const reply = await request('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service, method, args, revision }) }) as { result: unknown; snapshot: Snapshot }
        if (epoch !== generation) return { ok: false, message: 'Account changed. This operation was cancelled.' }
        install(reply.snapshot)
        return reply.result
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to save. Your edits have not been saved.'
        if (epoch === generation) {
          set({ message })
          // A conflict refreshes saved records without replaying the user's mutation.
          try { const latest = await request('/api/data') as Snapshot; if (epoch === generation) install(latest) } catch { /* Keep the known snapshot and show the original error. */ }
        }
        return { ok: false, message }
      } finally { if (epoch === generation) set({ pending: Math.max(0, status.pending - 1) }) }
    })
    queue = result
    return result
  },
  async flush() { await queue },
  async reset() {
    await queue
    const epoch = generation
    try { const snapshot = await request('/api/data', { method: 'DELETE' }) as Snapshot; if (epoch !== generation) return { ok: false, message: 'Account changed.' }; install(snapshot, true); return { ok: true } }
    catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Reset failed.' } }
  },
}

// Presentation state retains synchronous reads; writes are serialized to the backend.
dataStore.writeCollection = (key, value) => {
  if (!['workspaceDocument', 'pageViews'].includes(key)) return { status: 'invalid' }
  const result = writeCollection(key, value)
  if (result.status === 'saved') {
    const sequence = ++overlaySequence, epoch = generation
    overlays.set(key, { sequence, value: structuredClone(value) })
    void cloudStore.mutate('state', 'writeCollection', [key, value]).then(async () => {
      if (epoch !== generation || overlays.get(key)?.sequence !== sequence) return
      overlays.delete(key)
      // Install the confirmed state once all presentation writes have drained.
      await cloudStore.flush()
      if (epoch !== generation) return
      try { const saved = await request('/api/data') as Snapshot; if (epoch === generation) install(saved) } catch { /* The save error is already surfaced. */ }
    })
  }
  return result
}
dataStore.dispatch = (action: Action) => {
  if (action.type === 'filters') dispatch(action)
  else if (action.type === 'undo') void cloudStore.mutate('state', 'undo', [])
  else if (action.type === 'dismiss' || action.type === 'restore-dismiss') void cloudStore.mutate('state', action.type === 'dismiss' ? 'dismiss' : 'restore', [action.id])
  else throw new Error('Record changes must use an authenticated service.')
}

type Remote<T, Keys extends keyof T> = { [Key in keyof T]: Key extends Keys ? T[Key] extends (...args: infer Args) => infer Result ? (...args: Args) => Promise<Awaited<Result>> : T[Key] : T[Key] }
export function remoteService<T extends object, Keys extends keyof T>(name: string, local: T, methods: readonly Keys[]): Remote<T, Keys> {
  return new Proxy(local, { get(target, key, receiver) { return methods.includes(key as Keys) ? (...args: unknown[]) => cloudStore.mutate(name, String(key), args) : Reflect.get(target, key, receiver) } }) as Remote<T, Keys>
}

setApiBeforeRequest(async url => { if (['/api/generate', '/api/intent', '/api/workspace/compose', '/api/workspace/resolve'].includes(url)) await cloudStore.flush() })
