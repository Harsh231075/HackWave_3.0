import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { createProfileService } from './profileService.ts'
import { createCollection } from './local/collection.ts'
const schema = z.object({ id: z.string().min(1), profileId: z.string().min(1) })
export function createSharingService(database: BrowserDatabase, profiles: ReturnType<typeof createProfileService>) {
  const members = createCollection(database, 'members', schema)
  return {
    listMembers: members.list,
    addLocalMember(profileId: string) {
      if (!profiles.getById(profileId)) return { ok: false as const, message: 'Select an existing local profile.' }
      const existing = members.list().find(member => member.profileId === profileId)
      return existing ? { ok: true as const, value: existing } : members.create({ profileId })
    },
    removeMember: members.delete,
    invite() { return { ok: false as const, message: 'Sending invitations requires a backend. Local members do not share data across devices.' } },
  }
}
