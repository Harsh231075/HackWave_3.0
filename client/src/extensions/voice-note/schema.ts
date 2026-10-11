import { z } from 'zod'
export const MAX_RECORDING_MS = 120000
export const MAX_AUDIO_BYTES = 5 * 1024 * 1024
export const voiceNoteSchema = z.object({ id: z.string(), projectId: z.string(), noteId: z.string(), audioId: z.string(), durationMs: z.number().min(0).max(MAX_RECORDING_MS), mimeType: z.string().startsWith('audio/'), size: z.number().min(1).max(MAX_AUDIO_BYTES), createdAt: z.iso.datetime() })
