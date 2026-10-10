import type { StorageAdapter } from '../contracts.ts'
export type StorageSource = () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function createBrowserStorage(source: StorageSource = () => globalThis.localStorage): StorageAdapter {
  const readString: StorageAdapter['readString'] = key => {
    try { const value = source().getItem(key); return value === null ? { status: 'missing' } : { status: 'found', value } }
    catch { return { status: 'unavailable' } }
  }
  const writeString: StorageAdapter['writeString'] = (key, value) => {
    try { source().setItem(key, value); return { status: 'saved' } }
    catch { return { status: 'unavailable' } }
  }
  return {
    readString, writeString,
    readJson(key) {
      const result = readString(key)
      if (result.status !== 'found') return result
      try { return { status: 'found', value: JSON.parse(result.value) } }
      catch { return { status: 'invalid' } }
    },
    writeJson(key, value) {
      let serialized: string
      try { serialized = JSON.stringify(value); if (serialized === undefined) return { status: 'invalid' } }
      catch { return { status: 'invalid' } }
      return writeString(key, serialized)
    },
    remove(key) {
      try { source().removeItem(key); return { status: 'saved' } }
      catch { return { status: 'unavailable' } }
    },
  }
}
