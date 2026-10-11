import { compositionActionsSchema, actionReferencesValid, serializeActionButtons } from './workspaceActions.ts'
import { z } from 'zod'
import { intentDateSchema, resolvedIntentSchema } from './intent.ts'
const id = z.string().trim().min(1).max(160)
const text = z.string().max(5000)
export const clientSchema = z.strictObject({ id, name: id, description: text })
export const adaptiveProjectSchema = z.object({ id, name: id, description: text.default(''), clientId: id.optional() })
export const meetingSchema = z.strictObject({ id, title: id, clientId: id, projectId: id, date: intentDateSchema,
  start: z.iso.time({ precision: -1 }), end: z.iso.time({ precision: -1 }), participants: z.array(id).max(30), agenda: text, eventId: id.optional(),
}).refine(value => value.start < value.end, 'Meeting end must follow its start.')
export const communicationSchema = z.strictObject({ id, clientId: id, projectId: id, meetingId: id.optional(), date: intentDateSchema, sender: id, subject: id, body: text })
export const issueSchema = z.strictObject({ id, clientId: id, projectId: id, meetingId: id.optional(), title: id, description: text, status: z.enum(['open', 'closed']), owner: id })
export const relationshipSchema = z.strictObject({ id, sourceKind: z.enum(['project', 'meeting']), sourceId: id,
  targetKind: z.enum(['task', 'resource', 'meeting']), targetId: id, type: z.enum(['related', 'previous_meeting']),
}).refine(link => link.type === 'previous_meeting' ? link.sourceKind === 'meeting' && link.targetKind === 'meeting' : link.targetKind !== 'meeting', 'Invalid relationship type.')
export const adaptiveTaskSchema = z.strictObject({ id, title: text, description: text, owner: id, due: intentDateSchema, duration: z.number().min(5).max(480), priority: z.enum(['urgent', 'high', 'medium', 'low']), status: z.enum(['pending', 'blocked', 'completed']) })
export const adaptiveResourceSchema = z.strictObject({ id, title: text, kind: id, context: text, body: text })
export const evidenceSchema = z.strictObject({ kind: z.enum(['client', 'project', 'meeting', 'task', 'resource', 'communication', 'issue']), id })
export const preparationSchema = z.strictObject({ meeting: meetingSchema, client: clientSchema, project: adaptiveProjectSchema,
  tasks: z.array(adaptiveTaskSchema).max(100), resources: z.array(adaptiveResourceSchema).max(100),
  previousMeeting: meetingSchema.nullable(), communications: z.array(communicationSchema).max(10), issues: z.array(issueSchema).max(100),
  reasons: z.record(z.string(), z.string().max(500)),
}).superRefine((data, ctx) => {
  if (data.meeting.clientId !== data.client.id || data.meeting.projectId !== data.project.id || data.project.clientId !== data.client.id) ctx.addIssue({ code: 'custom', message: 'Meeting ownership is inconsistent.' })
  for (const item of [...data.communications, ...data.issues]) if (item.clientId !== data.client.id || item.projectId !== data.project.id || (item.meetingId && item.meetingId !== data.meeting.id)) ctx.addIssue({ code: 'custom', message: 'Records must belong to the selected scope.' })
  if (data.previousMeeting && (data.previousMeeting.clientId !== data.client.id || data.previousMeeting.projectId !== data.project.id || data.previousMeeting.date >= data.meeting.date)) ctx.addIssue({ code: 'custom', message: 'Previous meeting must belong to this project and precede this meeting.' })
})
export const meetingWidgetTypes = ['context', 'meetings', 'tasks', 'resources', 'outline', 'communications', 'issues'] as const
export const meetingCompositionSchema = z.strictObject({ version: z.literal(1), requestId: id, actions: compositionActionsSchema,
  widgets: z.array(z.strictObject({ type: z.enum(meetingWidgetTypes), span: z.enum(['wide', 'narrow', 'full']), reason: z.string().trim().min(1).max(500), evidence: z.array(evidenceSchema).min(1).max(20) })).min(2).max(7),
}).superRefine((plan, ctx) => {
  const types = plan.widgets.map(widget => widget.type)
  if (new Set(types).size !== types.length || !types.includes('context') || !types.includes('outline')) ctx.addIssue({ code: 'custom', message: 'Use each widget once and include context and outline.' })
})
export const composeRequestSchema = z.strictObject({ version: z.literal(1), requestId: id, intent: resolvedIntentSchema, preparation: preparationSchema, agenda: text, previousComposition: meetingCompositionSchema.optional() })
  .refine(input => input.intent.goalType === 'meeting_preparation' && input.intent.meetingId === input.preparation.meeting.id && (!input.intent.clientId || input.intent.clientId === input.preparation.client.id) && (!input.intent.projectId || input.intent.projectId === input.preparation.project.id), 'Composition must match the resolved meeting.')
export type Preparation = z.infer<typeof preparationSchema>
export type MeetingComposition = z.infer<typeof meetingCompositionSchema>
export type ComposeRequest = z.infer<typeof composeRequestSchema>
export type Meeting = z.infer<typeof meetingSchema>
export function evidenceRecords(data: Preparation) {
  return [ { kind: 'client', record: data.client }, { kind: 'project', record: data.project }, { kind: 'meeting', record: data.meeting },
    ...(data.previousMeeting ? [{ kind: 'meeting', record: data.previousMeeting }] : []),
    ...data.tasks.map(record => ({ kind: 'task', record })), ...data.resources.map(record => ({ kind: 'resource', record })),
    ...data.communications.map(record => ({ kind: 'communication', record })), ...data.issues.map(record => ({ kind: 'issue', record })),
  ]
}
export function validateMeetingComposition(value: unknown, request: ComposeRequest) {
  const input = composeRequestSchema.safeParse(request)
  const available = new Set(input.success ? evidenceRecords(input.data.preparation).map(item => `${item.kind}:${item.record.id}`) : [])
  return meetingCompositionSchema.superRefine((plan, ctx) => {
    if (!input.success) ctx.addIssue({ code: 'custom', message: 'Composition scope no longer matches its records.' })
    if (plan.requestId !== request.requestId) ctx.addIssue({ code: 'custom', message: 'Composition belongs to another request.' })
    for (const widget of plan.widgets) for (const evidence of widget.evidence) if (!available.has(`${evidence.kind}:${evidence.id}`)) ctx.addIssue({ code: 'custom', message: 'Unknown composition evidence.' })
    if (!actionReferencesValid(plan.actions, input.success ? input.data.preparation.tasks : [], true)) ctx.addIssue({ code: 'custom', message: 'Action references must belong to this scope and support the requested operation.' })
  }).safeParse(value)
}
export function serializeMeetingComposition(plan: MeetingComposition) {
  return `root = Card([Workspace([${plan.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.type)}, ${JSON.stringify(widget.span)})`).join(', ')}])${serializeActionButtons(plan.actions)}])`
}
