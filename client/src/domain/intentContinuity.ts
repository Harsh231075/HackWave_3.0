import { projectHasClient } from './projects.ts'
import { continuationChangeSchema } from './intentChanges.ts'
import { partialIntentSchema, type IntentRequest } from './intent.ts'
/** Inherit scope from declared usage changes and bounded overdue follow-ups. Model output still passes the full contract validator. */
export function applyIntentContinuity(value: unknown, request: IntentRequest): unknown {
  if (!value || typeof value !== 'object') return value
  const response = value as Record<string, unknown>
  const declared = continuationChangeSchema.safeParse(request.continuation ?? response.continuation)
  if (response.status === 'resolved' && declared.success && request.previousIntent && !request.clarificationAnswer) {
    if (declared.data.relationship === 'new_goal') return value
    const intent = structuredClone(request.previousIntent)
    const constraints = { ...intent.constraints }
    const allowed = new Set(['clientId', 'projectId', 'meetingId', 'dateRange', 'status', 'priority', 'segment'])
    for (const [field, patch] of Object.entries(declared.data.changes)) {
      if (!allowed.has(field)) return { version: 1, requestId: request.requestId, originalGoal: request.goal, status: 'unsupported', reason: 'This workflow does not support that refinement.' }
      if (['status', 'priority', 'segment'].includes(field)) {
        if (patch.operation === 'clear' || patch.operation === 'set' && (patch.value === 'all' || field === 'status' && patch.value === 'overdue' && intent.goalType === 'overdue_review')) delete constraints[field as keyof typeof constraints]
        else Object.assign(constraints, { [field]: patch.value })
      } else if (patch.operation === 'clear') Reflect.deleteProperty(intent, field)
      else Object.assign(intent, { [field]: patch.value })
    }
    intent.constraints = constraints
    const changes = declared.data.changes
    if (changes.clientId && !changes.projectId && intent.projectId && !projectHasClient(request.candidates.projects.find(p => p.id === intent.projectId), intent.clientId)) {
      delete intent.projectId; delete intent.meetingId
    }
    if (changes.projectId?.operation === 'set') {
      const project = request.candidates.projects.find(p => p.id === intent.projectId)
      if (project?.clientIds === undefined) intent.clientId = project?.clientId
      else if (!projectHasClient(project, intent.clientId)) delete intent.clientId
      if (!changes.meetingId) delete intent.meetingId
    }
    if (changes.meetingId?.operation === 'set') {
      const meeting = request.candidates.meetings.find(m => m.id === intent.meetingId)
      if (meeting) { intent.clientId = meeting.clientId; intent.projectId = meeting.projectId; intent.dateRange = { from: meeting.date, to: meeting.date } }
    }
    if (intent.goalType === 'meeting_preparation' && changes.dateRange && !changes.meetingId) {
      const matching = request.candidates.meetings.filter(m => m.date >= intent.dateRange?.from && m.date <= intent.dateRange?.to && (!intent.clientId || m.clientId === intent.clientId) && (!intent.projectId || m.projectId === intent.projectId))
      if (matching.length === 1) { intent.meetingId = matching[0].id; intent.dateRange = { from: matching[0].date, to: matching[0].date } }
      else delete intent.meetingId
    }
    const required = intent.goalType === 'meeting_preparation' ? 'meetingId' : intent.goalType === 'overdue_review' ? 'projectId' : request.candidates.projects.some(p=>p.clientIds !== undefined) ? 'projectId' : 'clientId'
    const field = !intent[required] ? required : !intent.dateRange ? 'dateRange' : undefined
    if (field) {
      const choices = field === 'dateRange' ? [] : field === 'meetingId' ? request.candidates.meetings.filter(m => (!intent.clientId || m.clientId === intent.clientId) && (!intent.projectId || m.projectId === intent.projectId)) : field === 'projectId' ? request.candidates.projects.filter(p => !intent.clientId || projectHasClient(p, intent.clientId)) : request.candidates.clients
      if (field !== 'dateRange' && choices.length === 1) {
        const choice = choices[0]
        Object.assign(intent, { [field]: choice.id })
        if (field === 'projectId') intent.clientId = request.candidates.projects.find(p => p.id === choice.id)?.clientId
        if (field === 'meetingId') { const meeting = request.candidates.meetings.find(m => m.id === choice.id)!; intent.clientId = meeting.clientId; intent.projectId = meeting.projectId; intent.dateRange = { from: meeting.date, to: meeting.date } }
      } else if (field === 'dateRange' || choices.length > 1) {
        return { version: 1, requestId: request.requestId, originalGoal: request.goal, status: 'needs_clarification', field, question: field === 'dateRange' ? 'Which date range should this use?' : 'Which ' + field.replace('Id', '') + ' should this use?', choices: choices.map(c => ({ id: c.id, label: c.label })), partialIntent: intent }
      } else return { version: 1, requestId: request.requestId, originalGoal: request.goal, status: 'unsupported', reason: 'No matching records remain for this scope.' }
    }
    return { ...response, intent, continuation: declared.data }
  }
  if (response.status === 'resolved' && request.followUpOf && request.previousIntent?.goalType === 'usage_investigation' && !request.clarificationAnswer && response.intent && typeof response.intent === 'object') {
    const parsed = partialIntentSchema.safeParse(response.intent)
    if (!parsed.success) return value
    const proposed = parsed.data
    const changes = response.scopeChanges
    if (proposed.goalType === 'usage_investigation' && Array.isArray(changes) && changes.every(field => ['clientId', 'projectId', 'dateRange', 'segment'].includes(field))) {
      const intent = { ...request.previousIntent, constraints: { ...request.previousIntent.constraints } }
      if (changes.includes('clientId')) {
        intent.clientId = proposed.clientId as string
        if (!changes.includes('projectId')) delete intent.projectId
      }
      if (changes.includes('projectId')) {
        intent.projectId = proposed.projectId as string | undefined
        if (intent.projectId && !changes.includes('clientId')) { const project = request.candidates.projects.find(p => p.id === intent.projectId); if(project?.clientIds === undefined) intent.clientId=project?.clientId; else if(!projectHasClient(project,intent.clientId)) delete intent.clientId }
      }
      if (changes.includes('dateRange')) intent.dateRange = proposed.dateRange as typeof intent.dateRange
      if (changes.includes('segment')) {
        const segment = (proposed.constraints as { segment?: string } | undefined)?.segment
        if (segment) intent.constraints.segment = segment
        else delete intent.constraints.segment
      }
      return { ...response, intent }
    }
  }
  if (response.status !== 'resolved' || !response.intent || typeof response.intent !== 'object' || !request.followUpOf || request.previousIntent?.goalType !== 'overdue_review') return value
  const goal = request.goal.toLowerCase().trim().replace(/[.!?]+$/, '')
  const blocked = /^(only|show only|show|just)(?: the)? blocked (tasks|items|work)$/.test(goal)
  const all = /^show all overdue tasks$/.test(goal)
  if (!blocked && !all) return value
  const previous = request.previousIntent
  const constraints = { ...previous.constraints }
  if (blocked) constraints.status = 'blocked'
  else delete constraints.status
  return { ...response, intent: { ...previous, constraints } }
}
