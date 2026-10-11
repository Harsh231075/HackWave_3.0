import type { ActionResult } from '../domain/commands.ts'
import { workspaceReducer, emptyFilters, type Action } from '../domain/workspace.ts'
import type { DomainSnapshot, WorkspaceState } from '../domain/types.ts'
import { z } from 'zod'
import type { LoadResult, SaveResult, StorageAdapter } from './contracts.ts'
import { createWorkspaceService, persistedSchema } from './workspaceService.ts'

export interface BrowserDatabase {
  storage: StorageAdapter
  transaction<T>(operation:()=>ActionResult<T>):ActionResult<T>
  getRevision(): number
  getState(): WorkspaceState
  subscribe(listener: () => void): () => void
  dispatch(action: Action): void
  readCollection(key: string): LoadResult<unknown>
  writeCollection(key: string, value: unknown): SaveResult
  replaceRecords(snapshot: DomainSnapshot): SaveResult
  reset(): void
  replaceAll(snapshot: DomainSnapshot, collections: Record<string, unknown>): SaveResult
  getEpoch(): number
  getPersistenceResult(): SaveResult
}

// One in-memory state and one persistence writer for all task/event/draft services.
// Initialization is lazy so importing services never reads browser storage.
export function createBrowserDatabase(storage: StorageAdapter, seed: DomainSnapshot, seedCollections: Record<string, unknown> = {}): BrowserDatabase {
  const repository = createWorkspaceService(storage)
  let state: WorkspaceState | undefined
  let revision=0
  let epoch=0
  let batching=false, batchChanged=false
  let batchPersistence:SaveResult={status:'saved'}
  const persist=(result:SaveResult)=>{persistence=result;if(batching&&result.status!=='saved')batchPersistence=result}
  let persistence: SaveResult = { status: 'saved' }
  const collectionSchema = z.object({ version: z.literal(2), collections: z.record(z.string(), z.unknown()) })
  let collections: Record<string, unknown> | undefined
  const compatible=()=>repository.load().status!=='invalid'
  const loadCollections = (): LoadResult<Record<string, unknown>> => {
    if (collections) return { status: 'found', value: collections }
    if (!compatible()) return { status: 'invalid' }
    const loaded = storage.readJson('orlo-browser-db-v2')
    if (loaded.status === 'missing') { collections=structuredClone(seedCollections);return {status:'found',value:collections} }
    if (loaded.status === 'unavailable') { collections = structuredClone(seedCollections); return { status: 'found', value: collections } }
    if (loaded.status !== 'found') return loaded
    const result = collectionSchema.safeParse(loaded.value)
    if (!result.success) return { status: 'invalid' }
    collections = { ...structuredClone(seedCollections), ...result.data.collections }
    return { status: 'found', value: collections }
  }
  const log=(operation:string,kind:string,summary:string,entityId?:string,completion=false)=>{
    const loaded=loadCollections();if(loaded.status!=='found')return
    const prior=Array.isArray(loaded.value.recordActivity)?loaded.value.recordActivity:[]
    collections={...loaded.value,recordActivity:[{id:crypto.randomUUID(),at:new Date().toISOString(),operation,kind,summary,...(entityId?{entityId}:{}),completion},...prior].slice(0,1000)}
    const result=storage.writeJson('orlo-browser-db-v2',{version:2,collections})
    if(result.status!=='saved')persist(result)
  }
  const listeners = new Set<() => void>()
  const notifyListeners=()=>{if(batching){batchChanged=true;return}for(const listener of listeners)listener()}
  const initial = (): WorkspaceState => ({ ...structuredClone(seed), filters: emptyFilters(), history: [] })
  const getState = () => {
    if (!state) {
      const result = repository.load()
      state = compatible() && result.status === 'found' ? { ...initial(), ...result.value } : initial()
    }
    return state
  }
  const dispatch = (action: Action) => {
    if (loadCollections().status !== 'found') { persistence = { status: 'invalid' }; return }
    const previous = getState()
    const next = workspaceReducer(previous, action)
    if (next === previous) return
    state = next
    revision++
    if (action.type !== 'filters') {
      persist(repository.save(next))
      const entityId='id' in action?action.id:action.type==='task'?action.task.id:action.type==='event'?action.event.id:action.type==='draft'||action.type==='delete-draft'?action.key:undefined
      const after=next.tasks.find(t=>t.id===entityId),before=previous.tasks.find(t=>t.id===entityId)
      log(action.type,action.type.includes('task')||action.type==='toggle'?'task':action.type.includes('event')?'event':action.type.includes('draft')?'draft':'workspace',next.activity[0]??'Workspace changed',entityId,after?.status==='completed'&&before?.status!=='completed')
    }
    notifyListeners()
  }
  return {
    storage, getState, dispatch, getRevision:()=>revision, getEpoch:()=>epoch,
    transaction<T>(operation:()=>ActionResult<T>):ActionResult<T>{
      if(batching)return operation()
      const before=getState(),loaded=loadCollections(),savedCollections=loaded.status==='found'?structuredClone(loaded.value):undefined
      if(!savedCollections)return {ok:false,message:'Saved record collections are unavailable.'}
      batching=true;batchChanged=false;batchPersistence={status:'saved'}
      let result:ActionResult<T>
      try{result=operation()}catch{result={ok:false,message:'The record changes could not be completed.'}}
      if(!result.ok){state=before;collections=savedCollections;persist(repository.save(before));persist(storage.writeJson('orlo-browser-db-v2',{version:2,collections}));revision++}
      batching=false
      if(batchPersistence.status!=='saved')persistence=batchPersistence
      if(batchChanged)notifyListeners()
      return result
    },
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
      persist(storage.writeJson('orlo-browser-db-v2', { version: 2, collections }))
      if(['resources','issues','communications','relationships','usageObservations','usageReleases','files'].includes(key)){
        const before=Array.isArray(loaded.status==='found'?loaded.value[key]:null)?loaded.status==='found'?loaded.value[key] as Array<Record<string,unknown>>:[]:[]
        const after=Array.isArray(value)?value as Array<Record<string,unknown>>:[]
        const changes=[...after.filter(r=>JSON.stringify(before.find(p=>p.id===r.id))!==JSON.stringify(r)),...before.filter(r=>!after.some(p=>p.id===r.id))]
        const record=changes.length===1?changes[0]:undefined,exists=record&&before.some(r=>r.id===record.id),removed=record&&!after.some(r=>r.id===record.id)
        const operation=removed?'delete':exists?'update':'create'
        log(record?operation:'batch',key,record?`${operation}: ${String(record.title??record.name??record.subject??record.segment??key)}`:'Updated '+key,record?String(record.id):undefined)
      }
      revision++
      notifyListeners()
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
    replaceAll(snapshot, nextCollections) {
      const parsed = persistedSchema.safeParse(snapshot)
      if (!parsed.success) return { status: 'invalid' }
      state = { ...parsed.data, filters: emptyFilters(), history: [] }
      collections = structuredClone(nextCollections)
      epoch++; revision++
      const recordsResult = repository.save(state)
      const collectionsResult = storage.writeJson('orlo-browser-db-v2', { version: 2, collections })
      persistence = recordsResult.status === 'saved' && collectionsResult.status === 'saved' ? { status: 'saved' } : { status: 'unavailable' }
      notifyListeners()
      return persistence
    },
    getPersistenceResult: () => persistence,
  }
}
