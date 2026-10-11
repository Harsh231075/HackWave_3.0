import { z } from 'zod'
export const PROJECT_DATA_VERSION = 2
export const projectSettingsSchema = z.object({ version: z.literal(PROJECT_DATA_VERSION), defaultProjectId: z.string().min(1), selectedProjectId: z.string().min(1) })
export const projectClientSchema = z.object({ id: z.string().min(1), projectId: z.string().min(1), clientId: z.string().min(1), active: z.boolean() })
export const projectNoteSchema = z.object({ id: z.string().min(1), projectId: z.string().min(1), title: z.string().trim().min(1).max(160), kind: z.enum(['general', 'agenda', 'investigation']), meetingId: z.string().optional(), draftKey: z.string().min(1), pinned: z.boolean().default(false), createdAt: z.string().datetime().optional(), updatedAt: z.string().datetime().optional() })
export type ProjectNote = z.infer<typeof projectNoteSchema>
export function projectHasClient(project: { clientId?: string; clientIds?: string[] } | undefined, clientId?: string) {
  return !!project && (!clientId || project.clientIds?.includes(clientId) || project.clientId === clientId)
}
