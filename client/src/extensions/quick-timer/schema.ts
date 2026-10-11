import { z } from 'zod'
export const timerSchema = z.object({ id: z.string(),  taskId: z.string().optional(), durationMs: z.number().min(60000).max(180 * 60000), remainingMs: z.number().min(0), status: z.enum(['running', 'paused', 'finished']), endAt: z.number().optional(), startedAt: z.number() })
export const timerSessionSchema = z.object({ id: z.string(),  taskId: z.string().optional(), durationMs: z.number(), elapsedMs: z.number(), startedAt: z.number(), completedAt: z.number() })
export type QuickTimerState = z.infer<typeof timerSchema>
