import { z } from 'zod'

const identifier = z.string().trim().min(1)
const goal = z.string().trim().min(1).max(4000)
export const intentDateSchema = z.iso.date()
export const intentDateRangeSchema = z.strictObject({ from: intentDateSchema, to: intentDateSchema })
  .refine(range => range.from <= range.to, { message: 'The date range must end on or after its start.', path: ['to'] })
const timezone = z.string().trim().min(1).refine(value => {
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
}, 'Choose a valid IANA timezone.')
export const intentGoalTypeSchema = z.enum(['meeting_preparation', 'usage_investigation', 'overdue_review'])
const entityFields = { meetingId: identifier.optional(), clientId: identifier.optional(), projectId: identifier.optional() }
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
  const field = { meeting_preparation: 'meetingId', usage_investigation: 'clientId', overdue_review: 'projectId' } as const
  const required = field[intent.goalType]
  if (!intent[required]) ctx.addIssue({ code: 'custom', path: [required], message: `This goal requires ${required}.` })
})
const clientCandidateSchema = z.strictObject({ id: identifier, label: identifier })
const projectCandidateSchema = z.strictObject({ id: identifier, label: identifier, clientId: identifier.optional() })
const meetingCandidateSchema = z.strictObject({ id: identifier, label: identifier, date: intentDateSchema, clientId: identifier.optional(), projectId: identifier.optional() })
export const intentCandidatesSchema = z.strictObject({
  usageScopes: z.array(z.strictObject({ clientId: identifier, projectId: identifier, segments: identifier.array().max(100), dateRange: intentDateRangeSchema.nullable() })).max(1000).optional(),
  clients: z.array(clientCandidateSchema), projects: z.array(projectCandidateSchema), meetings: z.array(meetingCandidateSchema),
}).superRefine((catalog, ctx) => {
  for (const kind of ['clients', 'projects', 'meetings'] as const) {
    if (new Set(catalog[kind].map(item => item.id)).size !== catalog[kind].length) ctx.addIssue({ code: 'custom', path: [kind], message: 'Candidate IDs must be unique within an entity kind.' })
  }
  const clients = new Set(catalog.clients.map(item => item.id))
  const projects = new Map(catalog.projects.map(item => [item.id, item]))
  for (const [index, project] of catalog.projects.entries()) {
    if (project.clientId && !clients.has(project.clientId)) ctx.addIssue({ code: 'custom', path: ['projects', index, 'clientId'], message: 'Unknown client.' })
  }
  for (const scope of catalog.usageScopes ?? []) if (!clients.has(scope.clientId) || projects.get(scope.projectId)?.clientId !== scope.clientId || new Set(scope.segments).size !== scope.segments.length) ctx.addIssue({ code: 'custom', message: 'Invalid usage catalog ownership or segments.' })
  for (const [index, meeting] of catalog.meetings.entries()) {
    if (meeting.clientId && !clients.has(meeting.clientId)) ctx.addIssue({ code: 'custom', path: ['meetings', index, 'clientId'], message: 'Unknown client.' })
    if (meeting.projectId && !projects.has(meeting.projectId)) ctx.addIssue({ code: 'custom', path: ['meetings', index, 'projectId'], message: 'Unknown project.' })
    const projectClient = meeting.projectId ? projects.get(meeting.projectId)?.clientId : undefined
    if (meeting.clientId && projectClient && meeting.clientId !== projectClient) ctx.addIssue({ code: 'custom', path: ['meetings', index, 'clientId'], message: 'Meeting and project clients differ.' })
  }
})
const entityFieldSchema = z.enum(['meetingId', 'clientId', 'projectId'])
export const clarificationAnswerSchema = z.discriminatedUnion('field', [
  z.strictObject({ requestId: identifier, originalGoal: goal, field: entityFieldSchema, selectedId: identifier }),
  z.strictObject({ requestId: identifier, originalGoal: goal, field: z.literal('dateRange'), dateRange: intentDateRangeSchema }),
])
export const clarificationContextSchema = z.strictObject({
  requestId: identifier, originalGoal: goal, field: z.enum(['meetingId', 'clientId', 'projectId', 'dateRange']),
  choices: z.array(z.strictObject({ id: identifier, label: identifier })), partialIntent: partialIntentSchema,
})
const requestShape = z.strictObject({
  version: z.literal(1), requestId: identifier, goal,
  referenceDate: intentDateSchema, timezone, candidates: intentCandidatesSchema,
  followUpOf: identifier.optional(), previousIntent: resolvedIntentSchema.optional(), clarificationAnswer: clarificationAnswerSchema.optional(), clarificationContext: clarificationContextSchema.optional(),
})
export type IntentCandidates = z.infer<typeof intentCandidatesSchema>
export type ResolvedIntent = z.infer<typeof resolvedIntentSchema>
export type PartialIntent = z.infer<typeof partialIntentSchema>

function referenceIssues(intent: PartialIntent, catalog: IntentCandidates): Array<{ path: string[]; message: string }> {
  const issues: Array<{ path: string[]; message: string }> = []
  const add = (field: string, message: string) => issues.push({ path: [field], message })
  const meeting = catalog.meetings.find(item => item.id === intent.meetingId)
  const project = catalog.projects.find(item => item.id === intent.projectId)
  if (intent.meetingId && !meeting) add('meetingId', 'Unknown meeting.')
  if (intent.projectId && !project) add('projectId', 'Unknown project.')
  if (intent.clientId && !catalog.clients.some(item => item.id === intent.clientId)) add('clientId', 'Unknown client.')
  if (intent.projectId && meeting?.projectId && intent.projectId !== meeting.projectId) add('projectId', 'Project contradicts the selected meeting.')
  const meetingClient = meeting?.clientId ?? catalog.projects.find(item => item.id === meeting?.projectId)?.clientId
  if (intent.clientId && meetingClient && intent.clientId !== meetingClient) add('clientId', 'Client contradicts the selected meeting.')
  if (intent.clientId && project?.clientId && intent.clientId !== project.clientId) add('clientId', 'Client contradicts the selected project.')
  if (meetingClient && project?.clientId && meetingClient !== project.clientId) add('projectId', 'Project contradicts the meeting client.')
  if (intent.goalType === 'usage_investigation' && intent.constraints?.segment && catalog.usageScopes) {
    const scopes = catalog.usageScopes.filter(s => s.clientId === intent.clientId && (!intent.projectId || s.projectId === intent.projectId))
    if (!scopes.some(s => s.segments.includes(intent.constraints!.segment!))) add('constraints', 'Unknown usage segment for this scope.')
  }
  return issues
}
function candidatesFor(field: z.infer<typeof entityFieldSchema>, catalog: IntentCandidates) {
  return catalog[{ meetingId: 'meetings', clientId: 'clients', projectId: 'projects' }[field] as 'meetings' | 'clients' | 'projects']
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
const responseFields = { version: z.literal(1), requestId: identifier, originalGoal: goal }
const choiceSchema = z.strictObject({ id: identifier, label: identifier })
const clarificationSchema = z.strictObject({
  ...responseFields, status: z.literal('needs_clarification'), question: identifier,
  field: z.enum(['meetingId', 'clientId', 'projectId', 'dateRange']),
  choices: z.array(choiceSchema), partialIntent: partialIntentSchema,
}).superRefine((response, ctx) => {
  if (response.field === 'dateRange' ? response.choices.length !== 0 : response.choices.length < 2) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Entity questions need at least two choices; date questions have no entity choices.' })
  if (new Set(response.choices.map(item => item.id)).size !== response.choices.length) ctx.addIssue({ code: 'custom', path: ['choices'], message: 'Choices must be distinct.' })
})
export const intentResolutionSchema = z.discriminatedUnion('status', [
  z.strictObject({ ...responseFields, status: z.literal('resolved'), intent: resolvedIntentSchema, scopeChanges: z.enum(['clientId', 'projectId', 'dateRange', 'segment']).array().max(4).optional() }),
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
    if (result.status === 'resolved' && result.intent.goalType === 'usage_investigation' && request.previousIntent?.goalType === 'usage_investigation' && request.followUpOf && !request.clarificationAnswer && !result.scopeChanges) ctx.addIssue({ code: 'custom', message: 'Usage follow-ups require explicit scope changes.' })
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
