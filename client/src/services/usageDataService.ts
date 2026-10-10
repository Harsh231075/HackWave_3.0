import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import { createCollection } from './local/collection.ts'
import { clientSchema, adaptiveProjectSchema } from '../domain/adaptiveData.ts'
import { usageObservationSchema, usageReleaseSchema, usageRecordKey, type UsageObservation } from '../domain/usage.ts'
function read<T extends { id: string }>(database: BrowserDatabase, key: string, schema: z.ZodType<T>, max: number): LoadResult<T[]> {
  const result = database.readCollection(key)
  if (result.status === 'missing') return { status: 'found', value: [] }
  if (result.status !== 'found') return result
  const parsed = schema.array().max(max).safeParse(result.value)
  return parsed.success && new Set(parsed.data.map(item => item.id)).size === parsed.data.length ? { status: 'found', value: parsed.data } : { status: 'invalid' }
}
export function createUsageDataService(database: BrowserDatabase) {
  function ownership() {
    const clients = read(database, 'clients', clientSchema, 1000), projects = read(database, 'projects', adaptiveProjectSchema, 1000)
    if (clients.status !== 'found' || projects.status !== 'found') return null
    return { clients: clients.value, projects: projects.value.filter(p => p.clientId && clients.value.some(c => c.id === p.clientId)) }
  }
  function snapshot() {
    const owners = ownership(), observations = read(database, 'usageObservations', usageObservationSchema, 10000), releases = read(database, 'usageReleases', usageReleaseSchema, 1000)
    if (!owners || observations.status !== 'found' || releases.status !== 'found') return null
    if (new Set(observations.value.map(usageRecordKey)).size !== observations.value.length) return null
    const valid = (r: { clientId: string; projectId: string }) => owners.projects.some(p => p.id === r.projectId && p.clientId === r.clientId)
    return { ...owners, observations: observations.value.filter(valid), releases: releases.value.filter(valid) }
  }
  function collection<T extends { id: string; clientId: string; projectId: string }>(key: string, schema: z.ZodType<T>) {
    const base = createCollection(database, key, schema)
    const save = (record: T) => {
      const parsed = schema.safeParse(record), owners = ownership()
      if (!parsed.success || !owners?.projects.some(p => p.id === parsed.data.projectId && p.clientId === parsed.data.clientId)) return { ok: false as const, message: 'Usage records require a project belonging to the selected client.' }
      if (key === 'usageObservations') {
        const observations = read(database, key, usageObservationSchema, 10000)
        if (observations.status !== 'found' || observations.value.some(r => r.id !== record.id && usageRecordKey(r) === usageRecordKey(record as unknown as UsageObservation))) return { ok: false as const, message: 'Invalid saved usage data or duplicate project/date/segment measurement.' }
      }
      return base.save(parsed.data)
    }
    return { ...base, save, create: (input: Omit<T, 'id'>) => save({ ...input, id: crypto.randomUUID() } as T), update: (id: string, patch: Partial<Omit<T, 'id'>>) => { const record = base.getById(id); return record ? save({ ...record, ...patch, id }) : { ok: false as const, message: 'This usage record is no longer available.' } } }
  }
  return { snapshot, observations: collection('usageObservations', usageObservationSchema), releases: collection('usageReleases', usageReleaseSchema),
    loadCatalog(): LoadResult<{ clients: z.infer<typeof clientSchema>[]; projects: z.infer<typeof adaptiveProjectSchema>[] }> {
      const data = snapshot()
      return data ? { status: 'found' as const, value: { clients: data.clients, projects: data.projects } } : { status: 'invalid' as const }
    },
  }
}
