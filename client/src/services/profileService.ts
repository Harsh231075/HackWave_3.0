import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
export const profileSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(160), email: z.string().email().optional(), timezone: z.string().min(1) })
export type Profile = z.infer<typeof profileSchema>
export function createProfileService(database: BrowserDatabase) {
  const profiles = createCollection(database, 'profiles', profileSchema)
  return { ...profiles, getProfile: profiles.getById, updateProfile: profiles.update }
}
