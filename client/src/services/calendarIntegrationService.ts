import { googleCalendarService } from './googleCalendarService.ts'
import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
const schema = z.object({ id: z.string().min(1), provider: z.enum(['google', 'outlook']), label: z.string().min(1), status: z.literal('disconnected') })
export function createCalendarIntegrationService(database: BrowserDatabase) {
  const connections = createCollection(database, 'calendarConnections', schema)
  return {
    // Local metadata remains backwards compatible; real OAuth calls use google.
    google: googleCalendarService,
    listConnections: connections.list,
    saveConnection: connections.create,
    disconnect: connections.delete,
    connect() { return { ok: false as const, message: 'Calendar authorization requires a backend integration.' } },
    sync() { return { ok: false as const, message: 'External calendar synchronization is not connected.' } },
  }
}
