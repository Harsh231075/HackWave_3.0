import { z } from 'zod'
import { intentDateSchema, intentDateRangeSchema } from './intent.ts'
const id = z.string().trim().min(1).max(160)
export const usageObservationSchema = z.strictObject({
  id, date: intentDateSchema, segment: id,
  sessions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), source: z.enum(['synthetic', 'manual']),
})
export const usageReleaseSchema = z.strictObject({
  id, date: intentDateSchema, title: id,
  description: z.string().max(5000), segments: id.array().max(30), source: z.enum(['synthetic', 'manual']),
})
export const usageQuerySchema = z.strictObject({  dateRange: intentDateRangeSchema.optional(), segment: id.optional() })
export type UsageObservation = z.infer<typeof usageObservationSchema>
export type UsageRelease = z.infer<typeof usageReleaseSchema>
export type UsageQuery = z.infer<typeof usageQuerySchema>
export type UsageComparison = { segment: string; from: string; to: string; baseline: number | null; current: number | null; changePercent: number | null; missingDays: number; expectedDays: number; explanation: string }
export function usageRecordKey(record: Omit<UsageObservation, 'id' | 'source' | 'sessions'>) {
  return JSON.stringify([record.date, record.segment])
}

export type UsagePeriodComparison = { segment: string; baselineRange: { from: string; to: string }; currentRange: { from: string; to: string }; baselineAverage: number | null; currentAverage: number | null; changePercent: number | null; missingDays: number; explanation: string }
