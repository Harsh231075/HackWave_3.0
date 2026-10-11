import { continuationChangeSchema } from './intentChanges.ts'
import { z } from 'zod'

// Explicit requests for removed containers must not become broad record queries.
export function requestsRemovedScope(goal: string) {
  return /\b(?:show|list|manage|create|delete|switch|select)\s+(?:all\s+|my\s+|the\s+)?(?:projects?|clients?)\b|\b(?:for|in|of|from)\s+(?:the\s+)?(?:project|client)\s+(?!meeting\b|work\b|tasks\b|review\b)\S+/i.test(goal)
}
const identifier = z.string().trim().min(1)
const goal = z.string().trim().min(1).max(4000)
export const intentDateSchema = z.iso.date()
export const intentDateRangeSchema = z.strictObject({ from: intentDateSchema, to: intentDateSchema })
  .refine(range => range.from <= range.to, { message: 'The date range must end on or after its start.', path: ['to'] })
const timezone = z.string().trim().min(1).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, 'Choose a valid IANA timezone.')
export const intentGoalTypeSchema = z.enum(['meeting_preparation', 'usage_investigation', 'overdue_review'])
const entityFields = { meetingId: identifier.optional() }
export const intentConstraintsSchema = z.strictObject({
  ownerId: identifier.optional(), status: z.enum(['pending', 'blocked', 'completed']).optional(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).optional(), segment: identifier.max(160).optional(),
})
export const partialIntentSchema = z.strictObject({
  goalType: intentGoalTypeSchema.optional(), ...entityFields,
  dateRange: intentDateRangeSchema.optional(), constraints: intentConstraintsSchema.optional(),
})
export const resolvedIntentSchema = z.strictObject({
  goalType: intentGoalTypeSchema, ...entityFields,
  dateRange: intentDateRangeSchema, constraints: intentConstraintsSchema.optional(),
}).superRefine((intent, ctx) => {
  if (intent.goalType === 'meeting_preparation' && !intent.meetingId) ctx.addIssue({code:'custom',path:['meetingId'],message:'Select a meeting.'})
})
const meetingCandidateSchema = z.strictObject({id:identifier,label:identifier,date:intentDateSchema})
export const intentCandidatesSchema = z.strictObject({ meetings: meetingCandidateSchema.array(), usageScopes:z.array(z.strictObject({segments:identifier.array().max(100),dateRange:intentDateRangeSchema.nullable()})).max(1).optional() }).superRefine((catalog,ctx)=>{
  if(new Set(catalog.meetings.map(m=>m.id)).size!==catalog.meetings.length)ctx.addIssue({code:'custom',message:'Meeting IDs must be unique.'})
})
const entityFieldSchema = z.enum(['meetingId'])
export const clarificationAnswerSchema = z.discriminatedUnion('field', [
  z.strictObject({ requestId: identifier, originalGoal: goal, field: entityFieldSchema, selectedId: identifier }),
  z.strictObject({ requestId: identifier, originalGoal: goal, field: z.literal('dateRange'), dateRange: intentDateRangeSchema }),
])
export const clarificationContextSchema = z.strictObject({
  requestId: identifier, originalGoal: goal, field: z.enum(['meetingId', 'dateRange']),
  choices: z.array(z.strictObject({ id: identifier, label: identifier })), partialIntent: partialIntentSchema,
})
const requestShape = z.strictObject({
  version: z.literal(2), requestId: identifier, goal,
  referenceDate: intentDateSchema, timezone, candidates: intentCandidatesSchema,
  continuation: continuationChangeSchema.optional(), followUpOf: identifier.optional(), previousIntent: resolvedIntentSchema.optional(), clarificationAnswer: clarificationAnswerSchema.optional(), clarificationContext: clarificationContextSchema.optional(),
})
export type IntentCandidates = z.infer<typeof intentCandidatesSchema>
export type ResolvedIntent = z.infer<typeof resolvedIntentSchema>
export type PartialIntent = z.infer<typeof partialIntentSchema>

function referenceIssues(intent: PartialIntent, catalog: IntentCandidates): Array<{ path: string[]; message: string }> {
  const issues: Array<{ path: string[]; message: string }> = []
  const add = (field: string, message: string) => issues.push({ path: [field], message })
  const meeting = catalog.meetings.find(item => item.id === intent.meetingId)
  if (intent.meetingId && !meeting) add('meetingId','Unknown meeting.')
  if(intent.goalType==='usage_investigation' && intent.constraints?.segment && catalog.usageScopes && !catalog.usageScopes.some(scope=>scope.segments.includes(intent.constraints!.segment!))) add('constraints','Unknown usage segment.')
  return issues
}
function candidatesFor(field: z.infer<typeof entityFieldSchema>, catalog: IntentCandidates) {
  return field === 'meetingId' ? catalog.meetings : []
}
export const intentRequestSchema = requestShape.superRefine((request, ctx) => {
  if (request.followUpOf && !request.previousIntent) ctx.addIssue({ code: 'custom', message: 'A follow-up requires previous intent.' })
  if (request.previousIntent) for (const issue of referenceIssues(request.previousIntent, request.candidates)) ctx.addIssue({ code: 'custom', ...issue, path: ['previousIntent', ...issue.path] })
  const answer = request.clarificationAnswer
  if (answer && answer.field !== 'dateRange' && !candidatesFor(answer.field, request.candidates).some(item => item.id === answer.selectedId)) ctx.addIssue({ code: 'custom', path: ['clarificationAnswer', 'selectedId'], message: 'Unknown clarification candidate.' })
  const context = request.clarificationContext
  if (!!answer !== !!context) ctx.addIssue({ code: 'custom', path: ['clarificationContext'], message: 'An answer requires its original clarification context.' })
  if (context) {
    for (const issue of referenceIssues(context.partialIntent, request.candidates)) ctx.addIssue({ code: 'custom', ...issue, path: ['clarificationContext', 'partialIntent', ...issue.path] })
    if (context.field === 'dateRange' ? context.choices.length !== 0 : context.choices.length < 2) ctx.addIssue({ code: 'custom', path: ['clarificationContext', 'choices'], message: 'Invalid clarification choices.' })
    if (new Set(context.choices.map(choice => choice.id)).size !== context.choices.length) ctx.addIssue({ code: 'custom', message: 'Duplicate clarification choices.' })
    if (context.field !== 'dateRange') for (const choice of context.choices) {
      if (referenceIssues({ ...context.partialIntent, [context.field]: choice.id }, request.candidates).length) ctx.addIssue({ code: 'custom', message: 'Clarification choice contradicts the retained scope.' })
      if (!candidatesFor(context.field, request.candidates).some(item => item.id === choice.id && item.label === choice.label)) ctx.addIssue({ code: 'custom', message: 'Clarification candidate is stale.' })
    }
    if (answer && (answer.requestId !== context.requestId || answer.originalGoal !== context.originalGoal || request.goal !== context.originalGoal || answer.field !== context.field || (answer.field !== 'dateRange' && !context.choices.some(choice => choice.id === answer.selectedId)))) ctx.addIssue({ code: 'custom', path: ['clarificationAnswer'], message: 'Answer does not match the offered question.' })
  }
})
export type IntentRequest = z.infer<typeof intentRequestSchema>
const responseFields = { version: z.literal(2), requestId: identifier, originalGoal: goal }
const choiceSchema = z.strictObject({ id: identifier, label: identifier })
export const clarificationSchema = z.strictObject({
  ...responseFields, status: z.literal('needs_clarification'), question: identifier,
  field: z.enum(['meetingId', 'dateRange']),
  choices: z.array(choiceSchema), partialIntent: partialIntentSchema,
}).superRefine((response, ctx) => {
  if (response.field === 'dateRange' ? response.choices.length !== 0 : response.choices.length < 2) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Entity questions need at least two choices; date questions have no entity choices.' })
  if (new Set(response.choices.map(item => item.id)).size !== response.choices.length) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices must be distinct.' })
})
export const intentResolutionSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...responseFields, status: z.literal('resolved'), intent: resolvedIntentSchema, continuation: continuationChangeSchema.optional(), scopeChanges: z.enum(['dateRange', 'segment']).array().max(4).optional() }),
  clarificationSchema,
  z.strictObject({ ...responseFields, status: z.literal('unsupported'), reason: identifier }),
])
export type IntentResolution = z.infer<typeof intentResolutionSchema>

/** Validate references against the exact catalog submitted for this request. */
export function validateIntentResolution(response: unknown, request: IntentRequest) {
  return intentResolutionSchema.superRefine((result, ctx) => {
    if (result.requestId !== request.requestId) ctx.addIssue({ code: 'custom', path: ['requestId'], message: 'Response belongs to another request.' })
    if (result.originalGoal !== request.goal) ctx.addIssue({ code: 'custom', path: ['originalGoal'], message: 'Response goal differs from the request.' })
    if (result.status === 'unsupported') return
    if (requestsRemovedScope(request.goal)) ctx.addIssue({ code: 'custom', message: 'Use a meeting, dates, segment or owner; this application has no project/client scope.' })
    if (result.status === 'resolved' && result.intent.goalType === 'usage_investigation' && request.previousIntent?.goalType === 'usage_investigation' && request.followUpOf && !request.clarificationAnswer && !result.scopeChanges && !result.continuation) ctx.addIssue({ code: 'custom', message: 'Usage follow-ups require explicit scope changes.' })
    if (result.status === 'resolved' && request.clarificationAnswer) {
      const answer = request.clarificationAnswer
      if (answer.field === 'dateRange' ? JSON.stringify(result.intent.dateRange) !== JSON.stringify(answer.dateRange) : result.intent[answer.field] !== answer.selectedId) ctx.addIssue({ code: 'custom', message: 'Resolution must respect the clarification answer.' })
    }
    const intent = result.status === 'resolved' ? result.intent : result.partialIntent
    const prefix = result.status === 'resolved' ? 'intent' : 'partialIntent'
    for (const issue of referenceIssues(intent, request.candidates)) ctx.addIssue({ code: 'custom', ...issue, path: [prefix, ...issue.path] })
    if (result.status === 'needs_clarification' && result.field !== 'dateRange') {
      const candidates = candidatesFor(result.field, request.candidates)
      for (const [index, choice] of result.choices.entries()) {
        const candidate = candidates.find(item => item.id === choice.id)
        if (candidate) {
          const scope = { ...result.partialIntent, [result.field]: candidate.id }
          if (referenceIssues(scope, request.candidates).length || (result.field === 'meetingId' && scope.dateRange && 'date' in candidate && (String(candidate.date) < scope.dateRange.from || String(candidate.date) > scope.dateRange.to))) ctx.addIssue({ code: 'custom', path: ['choices', index], message: 'Choice contradicts the clarified scope.' })
        }
        if (!candidate || candidate.label !== choice.label) ctx.addIssue({ code: 'custom', path: ['choices', index], message: 'Choice must match a candidate of the requested kind.' })
      }
    }
  }).safeParse(response)
}
