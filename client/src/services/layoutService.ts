import { z } from 'zod'
import type { LayoutService, StorageAdapter } from './contracts.ts'
export const layoutStorageKey = 'gogpt-app-layout-v1'
const schema = z.object({ version: z.literal(1), response: z.string().min(1) }).strict()
export function createLayoutService(storage: StorageAdapter, validate: (response: string) => boolean): LayoutService {
  const valid = (response: string) => { try { return validate(response) } catch { return false } }
  return {
    load() {
      const result = storage.readJson(layoutStorageKey)
      if (result.status !== 'found') return result
      const parsed = schema.safeParse(result.value)
      return parsed.success && valid(parsed.data.response) ? { status: 'found', value: parsed.data.response } : { status: 'invalid' }
    },
    save(response) {
      const parsed = schema.safeParse({ version: 1, response })
      return parsed.success && valid(response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' }
    },
    clear: () => storage.remove(layoutStorageKey),
  }
}
