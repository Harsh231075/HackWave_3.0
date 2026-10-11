import { z } from 'zod'
import { clarificationSchema, resolvedIntentSchema } from './intent.ts'
import { continuationChangeSchema } from './intentChanges.ts'
import { componentViewSchema } from './componentIntent.ts'
import { meetingCompositionSchema } from './adaptiveData.ts'
import { usageCompositionSchema } from './usageComposition.ts'

const id = z.string().min(1).max(200)
const clock = { referenceDate: z.iso.date(), timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false } }) }
export const successfulContinuationSchema = z.strictObject({
  requestId: id, goal: z.string().min(1).max(4000), targetInstanceIds: id.array().max(14), ...clock,
  provider: z.enum(['components', 'demo', 'google-calendar']), accountId: id.optional(),
  intent: resolvedIntentSchema.optional(),
  composition: z.union([meetingCompositionSchema, usageCompositionSchema]).optional(),
})
const pendingBase = { requestId: id, goal: z.string().min(1).max(4000), ...clock, targetInstanceIds: id.array().max(14).default([]), targetSignatures: z.record(id, z.string()).optional() }
export const pendingClarificationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...pendingBase, kind: z.literal('adaptive'), question: clarificationSchema, continuation: continuationChangeSchema.optional() }),
  z.strictObject({ ...pendingBase, kind: z.literal('component'), question: z.string().min(1).max(1000), choices: z.array(z.strictObject({ id: id.optional(), label: z.string().min(1).max(4000) })).max(14), proposed: componentViewSchema.optional(), useDemo: z.boolean().default(false), continuation: continuationChangeSchema.optional() }),
])
export const workspaceContinuationSchema = z.strictObject({
  lastSuccess: successfulContinuationSchema.optional(),
  pending: pendingClarificationSchema.optional(),
})
export type SuccessfulContinuation = z.infer<typeof successfulContinuationSchema>
export type PendingClarification = z.infer<typeof pendingClarificationSchema>
export type WorkspaceContinuation = z.infer<typeof workspaceContinuationSchema>
