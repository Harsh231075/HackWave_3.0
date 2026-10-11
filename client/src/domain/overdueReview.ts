import { compositionActionsSchema, actionReferencesValid, serializeActionButtons } from './workspaceActions.ts'
import { z } from 'zod'
import { adaptiveProjectSchema, clientSchema, adaptiveTaskSchema, adaptiveResourceSchema, relationshipSchema, evidenceSchema } from './adaptiveData.ts'
import { intentDateSchema, intentDateRangeSchema, resolvedIntentSchema } from './intent.ts'
export const overdueReviewSchema = z.strictObject({ project: adaptiveProjectSchema, client: clientSchema.nullable(), referenceDate: intentDateSchema, dateRange: intentDateRangeSchema, tasks: adaptiveTaskSchema.array(), resources: adaptiveResourceSchema.array(), relationships: relationshipSchema.array(), reasons: z.record(z.string(), z.string()) }).superRefine((data, ctx) => {
  if (data.project.clientId && data.client?.id !== data.project.clientId) ctx.addIssue({ code: 'custom', message: 'Project client must agree.' })
  if (data.relationships.some(l => l.sourceKind !== 'project' || l.sourceId !== data.project.id || l.type !== 'related')) ctx.addIssue({ code: 'custom', message: 'Review links must belong to its project.' })
  for (const [kind, records] of [['task', data.tasks], ['resource', data.resources]] as const) {
    if (new Set(records.map(r => r.id)).size !== records.length) ctx.addIssue({ code: 'custom', message: 'Duplicate review records.' })
    for (const record of records) if (!data.relationships.some(l => l.targetKind === kind && l.targetId === record.id)) ctx.addIssue({ code: 'custom', message: 'Review records require explicit project relationships.' })
  }
})
export type OverdueReview = z.infer<typeof overdueReviewSchema>
export const overdueWidgetTypes = ['context', 'metrics', 'tasks', 'recommendation', 'resources'] as const
export const overdueCompositionSchema = z.strictObject({ version: z.literal(1), requestId: z.string().min(1), actions: compositionActionsSchema, widgets: z.array(z.strictObject({ type: z.enum(overdueWidgetTypes), span: z.enum(['wide', 'narrow', 'full']), reason: z.string().min(1).max(500), evidence: evidenceSchema.array().min(1).max(20) })).min(2).max(5) }).superRefine((plan, ctx) => {
  const types = plan.widgets.map(w => w.type)
  if (new Set(types).size !== types.length || !types.includes('context') || !types.includes('tasks')) ctx.addIssue({ code: 'custom', message: 'Include context and tasks exactly once.' })
})
export const overdueComposeRequestSchema = z.strictObject({ version: z.literal(1), kind: z.literal('overdue'), requestId: z.string().min(1), intent: resolvedIntentSchema, review: overdueReviewSchema, previousComposition: overdueCompositionSchema.optional() }).superRefine((input, ctx) => {
  if (input.intent.goalType !== 'overdue_review' || input.intent.projectId !== input.review.project.id || (input.intent.clientId && input.intent.clientId !== input.review.client?.id) || input.intent.dateRange.from !== input.review.dateRange.from || input.intent.dateRange.to !== input.review.dateRange.to) ctx.addIssue({ code: 'custom', message: 'Review scope must match intent.' })
  for (const task of input.review.tasks) if (task.status === 'completed' || task.due >= input.review.referenceDate || task.due < input.intent.dateRange.from || task.due > input.intent.dateRange.to || (input.intent.constraints?.status && task.status !== input.intent.constraints.status) || (input.intent.constraints?.priority && task.priority !== input.intent.constraints.priority)) ctx.addIssue({ code: 'custom', message: 'Task falls outside review scope.' })
})
export type OverdueComposition = z.infer<typeof overdueCompositionSchema>
export type OverdueComposeRequest = z.infer<typeof overdueComposeRequestSchema>
export function overdueEvidenceRecords(data: OverdueReview) {
  return [{ kind: 'project', record: data.project }, ...(data.client ? [{ kind: 'client', record: data.client }] : []), ...data.tasks.map(record => ({ kind: 'task', record })), ...data.resources.map(record => ({ kind: 'resource', record }))]
}
export function validateOverdueComposition(value: unknown, request: OverdueComposeRequest) {
  const input = overdueComposeRequestSchema.safeParse(request)
  const ids = new Set(input.success ? overdueEvidenceRecords(input.data.review).map(item => `${item.kind}:${item.record.id}`) : [])
  return overdueCompositionSchema.superRefine((plan, ctx) => {
    if (!input.success || plan.requestId !== request.requestId) ctx.addIssue({ code: 'custom', message: 'Invalid review request identity or scope.' })
    for (const widget of plan.widgets) for (const ref of widget.evidence) if (!ids.has(`${ref.kind}:${ref.id}`)) ctx.addIssue({ code: 'custom', message: 'Unknown review evidence.' })
    if (!actionReferencesValid(plan.actions, input.success ? input.data.review.tasks : [], false)) ctx.addIssue({ code: 'custom', message: 'Action references must belong to this scope and support the requested operation.' })
  }).safeParse(value)
}
export const serializeOverdueComposition = (plan: OverdueComposition) => `root = Card([Workspace([${plan.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.type)}, ${JSON.stringify(widget.span)})`).join(', ')}])${serializeActionButtons(plan.actions)}])`
