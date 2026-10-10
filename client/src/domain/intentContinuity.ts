import { partialIntentSchema, type IntentRequest } from './intent.ts'
/** Inherit scope from declared usage changes and bounded overdue follow-ups. Model output still passes the full contract validator. */
export function applyIntentContinuity(value: unknown, request: IntentRequest): unknown {
  if (!value || typeof value !== 'object') return value
  const response = value as Record<string, unknown>
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
        if (intent.projectId && !changes.includes('clientId')) intent.clientId = request.candidates.projects.find(p => p.id === intent.projectId)?.clientId
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
  const blocked = /^(only|show only|show) blocked tasks$/.test(goal)
  const all = /^show all overdue tasks$/.test(goal)
  if (!blocked && !all) return value
  const previous = request.previousIntent
  const constraints = { ...previous.constraints }
  if (blocked) constraints.status = 'blocked'
  else delete constraints.status
  return { ...response, intent: { ...previous, constraints } }
}
