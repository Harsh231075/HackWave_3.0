import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { createProfileService } from './profileService.ts'
const sessionSchema = z.object({ profileId: z.string().min(1), mode: z.literal('local') })
export function createAuthService(database: BrowserDatabase, profiles: ReturnType<typeof createProfileService>) {
  return {
    getSession() {
      const loaded = database.readCollection('session')
      const parsed = sessionSchema.safeParse(loaded.status === 'found' ? loaded.value : null)
      return parsed.success && profiles.getById(parsed.data.profileId) ? parsed.data : null
    },
    selectLocalProfile(profileId: string) {
      if (!profiles.getById(profileId)) return { ok: false as const, message: 'This local profile is no longer available.' }
      const session = { profileId, mode: 'local' as const }
      const result = database.writeCollection('session', session)
      return result.status === 'invalid' ? { ok: false as const, message: 'Unable to save the local session.' } : { ok: true as const, value: session }
    },
    signIn() { return { ok: false as const, message: 'Account authentication requires a backend. Use selectLocalProfile for browser-only profiles.' } },
    signOut: () => database.writeCollection('session', null),
  }
}
