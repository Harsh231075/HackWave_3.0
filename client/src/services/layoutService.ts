import { z } from 'zod'
import type { StorageAdapter, LoadResult, SaveResult, LayoutService } from './contracts.ts'
import { meetingCompositionSchema, serializeMeetingComposition } from '../domain/adaptiveData.ts'
import { resolvedIntentSchema } from '../domain/intent.ts'
export const layoutStorageKey = 'gogpt-app-layout-v1'
const legacySchema = z.strictObject({ version: z.literal(1), response: z.string().min(1) })
export const meetingLayoutSchema = z.strictObject({ version: z.literal(2), kind: z.literal('meeting'), meetingId: z.string().min(1), intent: resolvedIntentSchema, composition: meetingCompositionSchema, response: z.string().min(1) })
  .refine(session => session.intent.goalType === 'meeting_preparation' && session.intent.meetingId === session.meetingId && session.response === serializeMeetingComposition(session.composition), 'Saved scope and composition must agree.')
const sessionSchema = z.union([legacySchema, z.strictObject({ version: z.literal(2), kind: z.literal('general'), response: z.string().min(1) }), meetingLayoutSchema])
export type LayoutSession = z.infer<typeof sessionSchema>
export type MeetingLayout = z.infer<typeof meetingLayoutSchema>
export function createLayoutService(storage: StorageAdapter, validate: (response: string) => boolean): LayoutService {
  const valid = (response: string) => { try { return validate(response) } catch { return false } }
  const loadSession = (): LoadResult<LayoutSession> => {
    const result = storage.readJson(layoutStorageKey)
    if (result.status !== 'found') return result
    const parsed = sessionSchema.safeParse(result.value)
    return parsed.success && valid(parsed.data.response) ? { status: 'found', value: parsed.data } : { status: 'invalid' }
  }
  return {
    loadSession,
    load(): LoadResult<string> { const loaded = loadSession(); return loaded.status === 'found' ? { status: 'found', value: loaded.value.response } : loaded },
    save(response: string): SaveResult {
      const parsed = legacySchema.safeParse({ version: 1, response })
      return parsed.success && valid(response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' }
    },
    saveMeeting(session: MeetingLayout): SaveResult {
      const parsed = meetingLayoutSchema.safeParse(session)
      return parsed.success && valid(parsed.data.response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' }
    },
    clear: () => storage.remove(layoutStorageKey),
  }
}
