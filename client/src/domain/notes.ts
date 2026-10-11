import { z } from 'zod'
export const noteSchema = z.strictObject({ id: z.string().min(1), title: z.string().trim().min(1).max(160), kind: z.enum(['general', 'agenda', 'investigation']), meetingId: z.string().optional(), dateRange: z.strictObject({from:z.iso.date(),to:z.iso.date()}).refine(range=>range.from<=range.to, 'Dates must be ordered.').optional(), segment: z.string().optional(), draftKey: z.string().min(1), pinned: z.boolean().default(false), createdAt: z.string().datetime().optional(), updatedAt: z.string().datetime().optional() })
export type NoteRecord = z.infer<typeof noteSchema>
