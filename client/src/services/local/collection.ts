import type { z } from 'zod'
import type { BrowserDatabase } from '../browserDatabase.ts'
import type { ActionResult } from '../../domain/commands.ts'
export function createCollection<T extends { id: string }>(database: BrowserDatabase, key: string, schema: z.ZodType<T>, createId: () => string = () => crypto.randomUUID()) {
  const list = (): T[] => {
    const loaded = database.readCollection(key)
    if (loaded.status !== 'found') return []
    const parsed = schema.array().safeParse(loaded.value)
    return parsed.success ? parsed.data : []
  }
  const save = (record: T): ActionResult<T> => {
    const parsed = schema.safeParse(record)
    if (!parsed.success) return { ok: false, message: `Invalid ${key} record.` }
    const loaded = database.readCollection(key)
    if (loaded.status === 'invalid' || (loaded.status === 'found' && !schema.array().safeParse(loaded.value).success)) return { ok: false, message: `Saved ${key} data is invalid and has been preserved.` }
    const records = list()
    const result = database.writeCollection(key, [...records.filter(item => item.id !== record.id), parsed.data])
    return result.status === 'invalid' ? { ok: false, message: `Unable to save ${key}.` } : { ok: true, value: structuredClone(parsed.data) }
  }
  const getById = (id: string) => list().find(item => item.id === id) ?? null
  return {
    list, getById, save,
    create(input: Omit<T, 'id'>) { return save({ ...input, id: createId() } as T) },
    update(id: string, patch: Partial<Omit<T, 'id'>>) { const record = getById(id); return record ? save({ ...record, ...patch, id }) : { ok: false as const, message: `This ${key} record is no longer available.` } },
    delete(id: string): ActionResult<void> {
      if (!getById(id)) return { ok: false, message: `This ${key} record is no longer available.` }
      const result = database.writeCollection(key, list().filter(record => record.id !== id))
      return result.status === 'invalid' ? { ok: false, message: `Unable to delete ${key}.` } : { ok: true, value: undefined }
    },
  }
}
