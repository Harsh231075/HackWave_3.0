import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
export const activityRecordSchema=z.object({id:z.string(),at:z.iso.datetime(),operation:z.string(),kind:z.string(),entityId:z.string().optional(),summary:z.string(),completion:z.boolean().optional()})
export type ActivityRecord=z.infer<typeof activityRecordSchema>
export function getActivityRecords(database:BrowserDatabase):ActivityRecord[]{const loaded=database.readCollection('recordActivity');const parsed=activityRecordSchema.array().safeParse(loaded.status==='found'?loaded.value:[]);return parsed.success?parsed.data:[]}
