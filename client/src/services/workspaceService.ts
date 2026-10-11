import { z } from 'zod'
import type { StorageAdapter, WorkspaceService } from './contracts.ts'
export const workspaceStorageKey = 'orlo-data-v2'
export const persistedSchema = z.strictObject({
  tasks: z.array(z.strictObject({ id: z.string(), title: z.string(), description: z.string(), owner: z.string(), due: z.string(), duration: z.number(), priority: z.enum(['urgent', 'high', 'medium', 'low']), status: z.enum(['pending', 'blocked', 'completed']) })),
  events: z.array(z.strictObject({ id: z.string(), title: z.string(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), category: z.enum(['meeting', 'focus', 'class', 'break']), participants: z.array(z.string()), agenda: z.string() })),
  drafts: z.record(z.string(), z.string()), dismissed: z.array(z.string()), activity: z.array(z.string()),
})
export function createWorkspaceService(storage: StorageAdapter): WorkspaceService {
  return {
    load() {
      const result = storage.readJson(workspaceStorageKey)
      if (result.status !== 'found') return result
      const parsed = persistedSchema.safeParse(result.value)
      return parsed.success ? { status: 'found', value: parsed.data } : { status: 'invalid' }
    },
    save(snapshot) {
      const {tasks,events,drafts,dismissed,activity}=snapshot
      const parsed = persistedSchema.safeParse({tasks,events,drafts,dismissed,activity})
      return parsed.success ? storage.writeJson(workspaceStorageKey, parsed.data) : { status: 'invalid' }
    },
  }
}
