import { z } from 'zod'

export const layoutStorageKey = 'gogpt-app-layout-v1'
export type LayoutStorage = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}
type StorageSource = () => LayoutStorage
export type LayoutResult = { status: 'saved'; response: string } | { status: 'missing' | 'invalid' | 'unavailable' }
const layoutSchema = z.object({ version: z.literal(1), response: z.string().min(1) }).strict()

export function readLayout(storage: StorageSource, validate: (response: string) => boolean): LayoutResult {
  let raw: string | null
  try { raw = storage().getItem(layoutStorageKey) } catch { return { status: 'unavailable' } }
  if (raw === null) return { status: 'missing' }
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(raw))
    return parsed.success && validate(parsed.data.response) ? { status: 'saved', response: parsed.data.response } : { status: 'invalid' }
  } catch { return { status: 'invalid' } }
}

export function saveLayout(storage: StorageSource, response: string): boolean {
  try {
    const layout = layoutSchema.parse({ version: 1, response })
    storage().setItem(layoutStorageKey, JSON.stringify(layout))
    return true
  } catch { return false }
}

export function clearLayout(storage: StorageSource): boolean {
  try { storage().removeItem(layoutStorageKey); return true } catch { return false }
}
