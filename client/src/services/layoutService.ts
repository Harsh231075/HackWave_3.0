import { taskFiltersSchema as meetingTaskFiltersSchema } from '../domain/widgetInstances.ts'
import { emptyFilters } from '../domain/workspace.ts'
import { usageCompositionSchema, serializeUsageComposition } from '../domain/usageComposition.ts'
import { overdueCompositionSchema, serializeOverdueComposition } from '../domain/overdueReview.ts'
import { z } from 'zod'
import type { StorageAdapter, LoadResult, SaveResult, LayoutService } from './contracts.ts'
import { meetingCompositionSchema, serializeMeetingComposition } from '../domain/adaptiveData.ts'
import { resolvedIntentSchema } from '../domain/intent.ts'
export const layoutStorageKey = 'orlo-layout-v3'
const generalLayoutSchema = z.strictObject({ version: z.literal(3), response: z.string().min(1) })
export { taskFiltersSchema as meetingTaskFiltersSchema } from '../domain/widgetInstances.ts'
export const meetingLayoutSchema = z.strictObject({ version: z.literal(3), kind: z.literal('meeting'), taskFilters: meetingTaskFiltersSchema.default(emptyFilters), meetingId: z.string().min(1), intent: resolvedIntentSchema, composition: meetingCompositionSchema, response: z.string().min(1) })
  .refine(session => session.intent.goalType === 'meeting_preparation' && session.intent.meetingId === session.meetingId && session.response === serializeMeetingComposition(session.composition), 'Saved scope and composition must agree.')
export const overdueLayoutSchema = z.strictObject({ version: z.literal(3), kind: z.literal('overdue'),  referenceDate: z.iso.date(), intent: resolvedIntentSchema, composition: overdueCompositionSchema, response: z.string().min(1), filters: z.strictObject({ query: z.string(), status: z.string(), priority: z.string(), sort: z.enum(['due', 'priority']), from: z.string(), to: z.string() }) }).refine(s => s.intent.goalType === 'overdue_review' && s.response === serializeOverdueComposition(s.composition), 'Saved overdue scope must agree.')
export type OverdueLayout = z.infer<typeof overdueLayoutSchema>
export const usageLayoutSchema = z.strictObject({ version: z.literal(3), kind: z.literal('usage'), taskFilters: z.strictObject({ query: z.string(), status: z.string(), priority: z.string(), sort: z.enum(['due', 'priority']), from: z.string(), to: z.string() }), snapshotFingerprint: z.string().min(1), intent: resolvedIntentSchema, composition: usageCompositionSchema, response: z.string().min(1) }).refine(s => s.intent.goalType === 'usage_investigation' && s.response === serializeUsageComposition(s.composition), 'Saved usage scope must agree.')
export type UsageLayout = z.infer<typeof usageLayoutSchema>
const sessionSchema = z.union([generalLayoutSchema, z.strictObject({ version: z.literal(3), kind: z.literal('general'), response: z.string().min(1) }), meetingLayoutSchema, overdueLayoutSchema, usageLayoutSchema])
export type LayoutSession = z.infer<typeof sessionSchema>
export type MeetingLayout = z.infer<typeof meetingLayoutSchema>
export type MeetingLayoutInput = z.input<typeof meetingLayoutSchema>
export function retainMeetingTaskFilters(current: MeetingLayout | null, next: MeetingLayout): MeetingLayout {
  return { ...next, taskFilters: current?.meetingId === next.meetingId ? { ...current.taskFilters } : emptyFilters() }
}
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
      const parsed = generalLayoutSchema.safeParse({ version: 3, response })
      return parsed.success && valid(response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' }
    },
    saveMeeting(session: MeetingLayoutInput): SaveResult {
      const parsed = meetingLayoutSchema.safeParse(session)
      return parsed.success && valid(parsed.data.response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' }
    },
    saveOverdue(session: OverdueLayout): SaveResult { const parsed = overdueLayoutSchema.safeParse(session); return parsed.success && valid(parsed.data.response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' } },
    saveUsage(session: UsageLayout): SaveResult { const parsed = usageLayoutSchema.safeParse(session); return parsed.success && valid(parsed.data.response) ? storage.writeJson(layoutStorageKey, parsed.data) : { status: 'invalid' } },
    clear: () => storage.remove(layoutStorageKey),
  }
}
