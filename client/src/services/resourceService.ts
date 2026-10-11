import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { Resource } from '../domain/types.ts'
export function createResourceService(resources: readonly Resource[], database?: BrowserDatabase) {
  const schema = z.object({ id: z.string().min(1),  title: z.string().trim().min(1), kind: z.string(), context: z.string(), body: z.string() })
  let local = structuredClone([...resources])
  const list = () => {
    if (!database) return structuredClone(local)
    const result = database.readCollection('resources')
    if (result.status === 'missing') return structuredClone([...resources])
    const parsed = schema.array().safeParse(result.status === 'found' ? result.value : null)
    return parsed.success ? parsed.data : []
  }
  return {
    create(input: Omit<Resource, 'id'>) {
      const record = { ...input, id: crypto.randomUUID() }
      const parsed = schema.safeParse(record)
      if (!parsed.success) return { ok: false as const, message: 'Invalid resource.' }
      const loaded = database?.readCollection('resources')
      if (loaded?.status === 'invalid' || (loaded?.status === 'found' && !schema.array().safeParse(loaded.value).success)) return { ok: false as const, message: 'Saved resources are invalid and have been preserved.' }
      local = [...list(), parsed.data]
      const result = database?.writeCollection('resources', local)
      return result?.status === 'invalid' ? { ok: false as const, message: 'Saved resources are invalid and have been preserved.' } : { ok: true as const, value: structuredClone(parsed.data) }
    },
    update(id: string, patch: Partial<Omit<Resource, 'id'>>) {
      const existing = list().find(record => record.id === id)
      if (!existing) return { ok: false as const, message: 'This resource is no longer available.' }
      const parsed = schema.safeParse({ ...existing, ...patch, id })
      if (!parsed.success) return { ok: false as const, message: 'Invalid resource.' }
      local = list().map(record => record.id === id ? parsed.data : record)
      const result = database?.writeCollection('resources', local)
      if (result?.status === 'invalid') return { ok: false as const, message: 'Saved resources are invalid and have been preserved.' }
      return { ok: true as const, value: structuredClone(parsed.data) }
    },
    delete(id: string) {
      if (!list().some(record => record.id === id)) return { ok: false as const, message: 'This resource is no longer available.' }
      local = list().filter(record => record.id !== id)
      const result = database?.writeCollection('resources', local)
      if (result?.status === 'invalid') return { ok: false as const, message: 'Saved resources are invalid and have been preserved.' }
      return { ok: true as const, value: undefined }
    },
    list: (context?: string) => structuredClone(list().filter(resource => context === undefined || resource.context === context)),
    getById(id: string) { const resource = list().find(item => item.id === id); return resource ? structuredClone(resource) : null },
  }
}
