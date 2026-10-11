/// <reference lib="dom" />
export interface AudioStorage { put(id: string, blob: Blob): Promise<void>; get(id: string): Promise<Blob | null>; delete(id: string): Promise<void>; clear(): Promise<void> }
export function createAudioStorage(factory = () => globalThis.indexedDB): AudioStorage {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    try { const request = factory().open('orlo-extension-audio', 1); request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('audio')) request.result.createObjectStore('audio') }; let blocked=false; request.onsuccess = () => {if(blocked)request.result.close();else resolve(request.result)}; request.onerror = () => reject(new Error('Audio storage could not be opened.')); request.onblocked = () => {blocked=true;reject(new Error('Close other Orlo tabs and retry audio storage.'))} } catch { reject(new Error('Audio storage is unavailable in this browser.')) }
  })
  let pending:Promise<unknown>=Promise.resolve()
  const execute = async <T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const database = await open()
    return new Promise((resolve, reject) => {
      try { const transaction = database.transaction('audio', mode), request = operation(transaction.objectStore('audio')); transaction.oncomplete = () => { database.close(); resolve(request.result) }; transaction.onerror = transaction.onabort = () => { database.close(); reject(new Error('Audio storage could not complete the operation.')) } } catch { database.close(); reject(new Error('Audio storage is unavailable.')) }
    })
  }
  const run=<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>=>{const next=pending.then(()=>execute(mode,operation));pending=next.catch(()=>undefined);return next}
  return { put: async (id, blob) => { await run('readwrite', store => store.put(blob, id)) }, get: async id => (await run('readonly', store => store.get(id))) ?? null, delete: async id => { await run('readwrite', store => store.delete(id)) }, clear: async () => { await run('readwrite', store => store.clear()) } }
}
