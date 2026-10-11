import { compositionActionsSchema, actionReferencesValid, serializeActionButtons } from './workspaceActions.ts'
import { z } from 'zod'
import { adaptiveTaskSchema, adaptiveResourceSchema, communicationSchema, issueSchema, relationshipSchema } from './adaptiveData.ts'
import { resolvedIntentSchema } from './intent.ts'
import { usageObservationSchema, usageReleaseSchema, usageQuerySchema } from './usage.ts'
export const usageWidgetTypes = ['context', 'usage', 'metrics', 'tasks', 'resources', 'communications', 'issues', 'outline'] as const
export const usageSnapshotSchema = z.strictObject({
  query: usageQuerySchema,
  observations: usageObservationSchema.array().max(10000), releases: usageReleaseSchema.array().max(1000),
  tasks: adaptiveTaskSchema.array().max(1000), resources: adaptiveResourceSchema.array().max(1000),
  communications: communicationSchema.array().max(1000), issues: issueSchema.array().max(1000), relationships: relationshipSchema.array().max(10000),
}).superRefine((data, ctx) => {
  for(const key of ['observations','releases','tasks','resources','communications','issues'] as const)if(new Set(data[key].map(r=>r.id)).size!==data[key].length)ctx.addIssue({code:'custom',message:'Duplicate usage evidence.'})
  for(const record of [...data.observations,...data.releases])if(data.query.dateRange&&(record.date<data.query.dateRange.from||record.date>data.query.dateRange.to))ctx.addIssue({code:'custom',message:'Evidence outside selected dates.'})
  if(data.observations.some(r=>data.query.segment&&r.segment!==data.query.segment)||data.releases.some(r=>data.query.segment&&r.segments.length&&!r.segments.includes(data.query.segment)))ctx.addIssue({code:'custom',message:'Evidence outside selected segment.'})
  const sources=new Set([...data.releases.map(r=>'release:'+r.id),...data.observations.map(r=>'observation:'+r.id)])
  if(data.relationships.some(r=>!sources.has(r.sourceKind+':'+r.sourceId)||r.type!=='related'))ctx.addIssue({code:'custom',message:'Invalid usage evidence link.'})
  for(const [kind,records] of [['task',data.tasks],['resource',data.resources],['communication',data.communications],['issue',data.issues]] as const)for(const record of records)if(!data.relationships.some(r=>r.targetKind===kind&&r.targetId===record.id))ctx.addIssue({code:'custom',message:'Usage work needs a direct evidence link.'})
})
export type UsageSnapshot = z.infer<typeof usageSnapshotSchema>
const evidence = z.strictObject({ kind: z.enum(['observation', 'release', 'task', 'resource', 'communication', 'issue']), id: z.string().min(1) })
export const usageCompositionSchema = z.strictObject({ version: z.literal(2), requestId: z.string().min(1), actions: compositionActionsSchema, widgets: z.array(z.strictObject({ type: z.enum(usageWidgetTypes), span: z.enum(['wide', 'narrow', 'full']), reason: z.string().min(1).max(500), evidence: evidence.array().max(20) })).min(2).max(8) }).superRefine((plan, ctx) => {
  const types = plan.widgets.map(w => w.type)
  if (new Set(types).size !== types.length || !types.includes('context') || !types.includes('usage')) ctx.addIssue({ code: 'custom', message: 'Include context and usage exactly once.' })
})
export type UsageComposition = z.infer<typeof usageCompositionSchema>
export const usageComposeRequestSchema = z.strictObject({ version: z.literal(2), kind: z.literal('usage'), requestId: z.string().min(1), intent: resolvedIntentSchema, snapshot: usageSnapshotSchema, draft: z.string().max(5000), previousComposition: usageCompositionSchema.optional() }).superRefine((input, ctx) => {
  const { intent, snapshot: { query } } = input
  if (intent.goalType !== 'usage_investigation' || intent.dateRange.from !== query.dateRange?.from || intent.dateRange.to !== query.dateRange?.to || intent.constraints?.segment !== query.segment) ctx.addIssue({ code: 'custom', message: 'Usage snapshot must match resolved intent.' })
})
export type UsageComposeRequest = z.infer<typeof usageComposeRequestSchema>
export function usageEvidenceRecords(data: UsageSnapshot) {
  return [...data.observations.map(record => ({ kind: 'observation', record })), ...data.releases.map(record => ({ kind: 'release', record })), ...data.tasks.map(record => ({ kind: 'task', record })), ...data.resources.map(record => ({ kind: 'resource', record })), ...data.communications.map(record => ({ kind: 'communication', record })), ...data.issues.map(record => ({ kind: 'issue', record }))]
}
export function validateUsageComposition(value: unknown, request: UsageComposeRequest) {
  const input = usageComposeRequestSchema.safeParse(request)
  const ids = new Set(input.success ? usageEvidenceRecords(input.data.snapshot).map(r => r.kind + ':' + r.record.id) : [])
  return usageCompositionSchema.superRefine((plan, ctx) => {
    if (!input.success || plan.requestId !== request.requestId) ctx.addIssue({ code: 'custom', message: 'Usage identity or scope mismatch.' })
    if (ids.size && plan.widgets.some(widget => !widget.evidence.length)) ctx.addIssue({ code: 'custom', message: 'Reference supplied records when evidence is available.' })
    for (const widget of plan.widgets) for (const ref of widget.evidence) if (!ids.has(ref.kind + ':' + ref.id)) ctx.addIssue({ code: 'custom', message: 'Unknown usage evidence.' })
    if (!actionReferencesValid(plan.actions, input.success ? input.data.snapshot.tasks : [], true)) ctx.addIssue({ code: 'custom', message: 'Action references must belong to this scope and support the requested operation.' })
  }).safeParse(value)
}
export const serializeUsageComposition = (plan: UsageComposition) => 'root = Card([Workspace([' + plan.widgets.map(w => 'WorkspaceWidget(' + JSON.stringify(w.type) + ', ' + JSON.stringify(w.span) + ')').join(', ') + '])' + serializeActionButtons(plan.actions) + '])'
export const usageDraftKey = (intent: {dateRange:{from:string;to:string};constraints?:{segment?:string}}) => 'usage-investigation:'+JSON.stringify([intent.dateRange.from,intent.dateRange.to,intent.constraints?.segment??'all'])
export function usageSnapshotFingerprint(snapshot: UsageSnapshot) {
  let hash = 2166136261
  const text = JSON.stringify(snapshot)
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(16)
}
