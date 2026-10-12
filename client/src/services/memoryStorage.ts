import type { StorageAdapter } from './contracts.ts'

// This adapter never accesses browser storage. It holds one authenticated session's cache.
export function createMemoryStorage() {
  const values = new Map<string, string>()
  const storage: StorageAdapter = {
    readString: key => values.has(key) ? { status: 'found', value: values.get(key)! } : { status: 'missing' },
    writeString(key, value) { values.set(key, value); return { status: 'saved' } },
    readJson(key) {
      const value = values.get(key)
      if (value === undefined) return { status: 'missing' }
      try { return { status: 'found', value: JSON.parse(value) } } catch { return { status: 'invalid' } }
    },
    writeJson(key, value) {
      try { values.set(key, JSON.stringify(value)); return { status: 'saved' } } catch { return { status: 'invalid' } }
    },
    remove(key) { values.delete(key); return { status: 'saved' } },
  }
  return { storage, clear: () => values.clear(), export: () => Object.fromEntries(values), replace(entries: Record<string, string>) { values.clear(); for (const [key, value] of Object.entries(entries)) values.set(key, value) } }
}
