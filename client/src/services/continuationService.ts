import { fingerprint } from '../domain/widgetInstances.ts'
import { loadActionScope } from './actionScope.ts'
import { createUsageDataService } from './usageDataService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { intentRequestSchema, type IntentCandidates } from '../domain/intent.ts'
import type { WorkspaceDocument } from '../domain/workspaceDocument.ts'
import type { PendingClarification, SuccessfulContinuation } from '../domain/workspaceContinuation.ts'

export function validateSavedContinuation(document: WorkspaceDocument, database: BrowserDatabase, accountId?: string): { lastSuccess?: SuccessfulContinuation; pending?: PendingClarification; stale: boolean } {
  const saved = document.continuation
  if (!saved) return { stale: false }
  const ids = new Set([...document.active, ...document.pins].map(w => w.instanceId))
  const catalog = createAdaptiveDataService(database).loadCandidates()
  const candidates: IntentCandidates = catalog.status === 'found' ? catalog.value : { clients: [], projects: [], meetings: [] }
  const usage = createUsageDataService(database)
  const usageData = usage.snapshot()
  if (usageData) candidates.usageScopes = candidates.projects.map(project => {
    const observations = usageData.observations.filter(record => record.projectId === project.id && (!project.clientId || record.clientId === project.clientId))
    const dates = observations.map(record => record.date).sort()
    return { ...(project.clientId ? {clientId:project.clientId} : {}), projectId: project.id, segments: [...new Set(observations.map(record => record.segment))], dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null }
  })
  const validTarget = (id: string) => { const target = [...document.active, ...document.pins].find(w => w.instanceId === id); return !!target && !!loadActionScope(database, target.binding) && (target.binding.kind !== 'google-calendar' || target.binding.accountId === accountId) }
  const last = saved.lastSuccess
  const validLast = last && last.targetInstanceIds.every(validTarget) && (last.provider !== 'google-calendar' || last.accountId === accountId) && (!last.intent || intentRequestSchema.safeParse({ version: 1, requestId: last.requestId, goal: last.goal, referenceDate: last.referenceDate, timezone: last.timezone, candidates, previousIntent: last.intent }).success)
  const pending = saved.pending
  let validPending = !!pending && pending.targetInstanceIds.every(validTarget)
  if (pending?.targetSignatures) validPending &&= Object.entries(pending.targetSignatures).every(([id, signature]) => {
    const target = [...document.active, ...document.pins].find(w => w.instanceId === id)
    return !!target && fingerprint({ binding: target.binding, viewState: target.viewState }) === signature
  })
  if (pending?.kind === 'adaptive') {
    const question = pending.question
    // Validate the same candidate/partial-scope constraints used when an answer is submitted.
    const answer = question.field === 'dateRange' ? { requestId: question.requestId, originalGoal: question.originalGoal, field: 'dateRange' as const, dateRange: question.partialIntent.dateRange ?? { from: pending.referenceDate, to: pending.referenceDate } } : { requestId: question.requestId, originalGoal: question.originalGoal, field: question.field, selectedId: question.choices[0]?.id ?? '' }
    validPending &&= intentRequestSchema.safeParse({ version: 1, requestId: pending.requestId, goal: question.originalGoal, referenceDate: pending.referenceDate, timezone: pending.timezone, candidates, clarificationAnswer: answer, clarificationContext: { requestId: question.requestId, originalGoal: question.originalGoal, field: question.field, choices: question.choices, partialIntent: question.partialIntent } }).success
  }
  if (pending?.kind === 'component' && pending.choices.some(c => c.id && !ids.has(c.id))) validPending = false
  return { lastSuccess: validLast ? last : undefined, pending: validPending ? pending : undefined, stale: !!last && !validLast || !!pending && !validPending }
}
