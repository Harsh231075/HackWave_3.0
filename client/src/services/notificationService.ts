import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
const notificationSchema = z.object({ id: z.string().min(1), message: z.string().min(1).max(2000), read: z.boolean(), createdAt: z.string().datetime() })
const settingsSchema = z.object({ reminders: z.boolean() })
export function createNotificationService(database: BrowserDatabase) {
  const notifications = createCollection(database, 'notifications', notificationSchema)
  return {
    ...notifications,
    markRead: (id: string) => notifications.update(id, { read: true }),
    getSettings() { const loaded = database.readCollection('notificationSettings'); const parsed = settingsSchema.safeParse(loaded.status === 'found' ? loaded.value : null); return parsed.success ? parsed.data : { reminders: false } },
    updateSettings(input: z.infer<typeof settingsSchema>) { const parsed = settingsSchema.safeParse(input); return parsed.success ? database.writeCollection('notificationSettings', parsed.data) : { status: 'invalid' as const } },
  }
}
