import type { SuccessfulContinuation } from '@/domain/workspaceContinuation'
import type { ContinuationChange } from '@/domain/intentChanges'
import { usageCompositionSchema } from '@/domain/usageComposition'
import { meetingCompositionSchema } from '@/domain/adaptiveData'
import { usageWorkspaceService, usageCompositionService, usageDataService, usageInvestigationService } from '@/services'
import { serializeUsageComposition, validateUsageComposition, usageSnapshotFingerprint, usageDraftKey, type UsageComposition } from '@/domain/usageComposition'
import type { UsageLayout } from '@/services/layoutService'
import { emptyFilters } from '@/domain/workspace'
import { overdueReviewService, overdueCompositionService } from '@/services'
import { serializeOverdueComposition, validateOverdueComposition } from '@/domain/overdueReview'
import type { OverdueLayout } from '@/services/layoutService'
import { useCallback, useEffect, useRef, useState } from 'react'
import { candidateCatalogService, intentService, meetingPreparationService, meetingCompositionService, generationService, browserDatabase } from '@/services'
import { DEMO_DATE } from '@/data/demo'
import { repairOpenUI, validLayout, validGeneratedLayout } from '@/lib/workspace/layoutValidation'
import { serializeMeetingComposition, validateMeetingComposition, type MeetingComposition } from '@/domain/adaptiveData'
import { intentRequestSchema, type IntentRequest, type IntentResolution, type ResolvedIntent } from '@/domain/intent'
import type { GenerateWorkspaceInput } from '@/services/contracts'
import type { MeetingLayout } from '@/services/layoutService'

export type Clarification = Extract<IntentResolution, { status: 'needs_clarification' }>
export type AdaptiveResult = { kind: 'usage'; session: UsageLayout } | { kind: 'overdue'; session: OverdueLayout } | { kind: 'meeting'; session: MeetingLayout } | { kind: 'general'; response: string }
export function useAdaptiveWorkspace(initialIntent?: ResolvedIntent, initialRequestId?: string, initialUsageComposition?: UsageComposition) {
  const [pending, setPending] = useState(false)
  const [error, setErrorState] = useState('')
  const lastError = useRef('')
  const setError = (value: string) => { lastError.current = value; setErrorState(value) }
  const [clarification, setClarification] = useState<Clarification | null>(null)
  const request = useRef<AbortController | null>(null)
  const previousUsageComposition = useRef(initialUsageComposition)
  const previousIntent = useRef(initialIntent)
  const previousComposition = useRef<MeetingComposition | undefined>(undefined)
  const previousRequestId = useRef<string | undefined>(initialRequestId)
  const question = useRef<Clarification | null>(null)
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; setPending(false); question.current = null; setClarification(null) }, [])
  const reset = () => { cancel(); previousIntent.current = undefined; previousRequestId.current = undefined; previousComposition.current = undefined; previousUsageComposition.current = undefined; setError('') }
  useEffect(() => () => request.current?.abort(), [])
  async function run(input: GenerateWorkspaceInput, answer?: IntentRequest['clarificationAnswer'], change?: ContinuationChange): Promise<AdaptiveResult | null> {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    const active = () => request.current === controller && !controller.signal.aborted
    setPending(true); setError('')
    try {
      const catalog = candidateCatalogService.load()
      if (catalog.status !== 'found') throw new Error('Saved meeting data is invalid and has been preserved. Choose another view or repair the saved data.')
      const usageCatalog = usageDataService.loadCatalog()
      if (usageCatalog.status === 'found') catalog.value.usageScopes = usageCatalog.value.projects.flatMap(project => {
        if (!project.clientId) return []
        const records = usageInvestigationService.load({ clientId: project.clientId, projectId: project.id })
        return records.status === 'found' ? [{ clientId: project.clientId, projectId: project.id, segments: records.value.availableSegments, dateRange: records.value.dateRange }] : []
      })
      const offered = answer ? question.current : null
      if (answer && !offered) throw new Error('This question is no longer active. Submit your goal again.')
      if (!answer) { question.current = null; setClarification(null) }
      const originalGoal = offered?.originalGoal ?? input.goal.trim()
      const payload: IntentRequest = {
        version: 1, requestId: crypto.randomUUID(), ...(change ? { continuation: change } : {}), goal: originalGoal, referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', candidates: catalog.value,
        ...(change?.relationship !== 'new_goal' && previousRequestId.current && previousIntent.current ? { followUpOf: previousRequestId.current } : {}),
        ...(change?.relationship !== 'new_goal' && previousIntent.current ? { previousIntent: previousIntent.current } : {}),
        ...(answer && offered ? { clarificationAnswer: answer, clarificationContext: { requestId: offered.requestId, originalGoal: offered.originalGoal, field: offered.field, choices: offered.choices, partialIntent: offered.partialIntent } } : {}),
      }
      if (payload.previousIntent && !intentRequestSchema.safeParse({ ...payload, clarificationAnswer: undefined, clarificationContext: undefined }).success) { delete payload.previousIntent; delete payload.followUpOf }
      const resolution = await intentService.resolve(payload, { signal: controller.signal })
      if (!active()) return null
      if (resolution.status === 'unsupported') { question.current = null; setClarification(null); setError(resolution.reason); return null }
      if (resolution.status === 'needs_clarification') { question.current = resolution; setClarification(resolution); return null }
      const intent = resolution.intent
      if (intent.goalType === 'usage_investigation') {
        const data = usageWorkspaceService.load(intent)
        if (data.status !== 'found') throw new Error('Usage records are unavailable or the selected range is invalid. Submit your goal again.')
        const compositionInput = { version: 1 as const, kind: 'usage' as const, requestId: payload.requestId, intent, snapshot: data.value.snapshot, draft: input.context.drafts[usageDraftKey(intent)] ?? '',
          ...(change?.relationship !== 'new_goal' && previousIntent.current?.goalType === 'usage_investigation' && previousIntent.current?.clientId === intent.clientId && previousIntent.current?.projectId === intent.projectId && previousUsageComposition.current ? { previousComposition: previousUsageComposition.current } : {}) }
        const composition = await usageCompositionService.compose(compositionInput, { signal: controller.signal })
        if (!active()) return null
        const current = usageWorkspaceService.load(intent)
        if (current.status !== 'found' || JSON.stringify(current.value.snapshot) !== JSON.stringify(data.value.snapshot) || !validateUsageComposition(composition, { ...compositionInput, snapshot: current.value.snapshot }).success) throw new Error('Supporting usage records changed while building the layout. Try again.')
        const response = serializeUsageComposition(composition)
        if (!validLayout(response)) throw new Error('The usage layout could not be validated.')
        previousIntent.current = intent; previousRequestId.current = payload.requestId; previousUsageComposition.current = composition; previousComposition.current = undefined; question.current = null; setClarification(null)
        return { kind: 'usage', session: { version: 2, kind: 'usage', taskFilters: emptyFilters(), snapshotFingerprint: usageSnapshotFingerprint(data.value.snapshot), intent, composition, response } }
      }
      if (intent.goalType === 'overdue_review') {
        const review = overdueReviewService.load(intent, DEMO_DATE)
        if (review.status !== 'found') throw new Error('This project review is unavailable. Submit your goal again.')
        const compositionInput = { version: 1 as const, kind: 'overdue' as const, requestId: payload.requestId, intent, review: review.value }
        const composition = await overdueCompositionService.compose(compositionInput, { signal: controller.signal })
        if (!active()) return null
        const current = overdueReviewService.load(intent, DEMO_DATE)
        if (current.status !== 'found' || !validateOverdueComposition(composition, { ...compositionInput, review: current.value }).success) throw new Error('Supporting records changed while building the review. Try again.')
        const response = serializeOverdueComposition(composition)
        if (!validLayout(response)) throw new Error('The overdue layout could not be validated.')
        previousIntent.current = intent; previousRequestId.current = payload.requestId; previousComposition.current = undefined; question.current = null; setClarification(null)
        return { kind: 'overdue', session: { version: 2, kind: 'overdue', projectId: intent.projectId!, referenceDate: DEMO_DATE, intent, composition, response, filters: emptyFilters() } }
      }
      if (intent.goalType !== 'meeting_preparation' || !intent.meetingId) {
        const output = await generationService.generate({ ...input, goal: originalGoal }, { signal: controller.signal })
        if (!active()) return null
        const response = repairOpenUI(output.response)
        if (!validGeneratedLayout(response, browserDatabase.getState().tasks)) throw new Error('The generated layout could not be validated. Try again.')
        previousIntent.current = intent; previousRequestId.current = payload.requestId; previousComposition.current = undefined; question.current = null; setClarification(null)
        return { kind: 'general', response }
      }
      const preparation = meetingPreparationService.load(intent.meetingId)
      if (preparation.status !== 'found') throw new Error('This meeting is no longer available. Submit your goal again.')
      const key = `meeting-agenda:${intent.meetingId}`
      const compositionInput = { version: 1 as const, requestId: payload.requestId, intent, preparation: preparation.value,
        agenda: input.context.drafts[key] ?? preparation.value.meeting.agenda,
        ...(change?.relationship !== 'new_goal' && previousIntent.current?.meetingId === intent.meetingId && previousComposition.current ? { previousComposition: previousComposition.current } : {}),
      }
      const composition = await meetingCompositionService.compose(compositionInput, { signal: controller.signal })
      if (!active()) return null
      const current = meetingPreparationService.load(intent.meetingId)
      if (current.status !== 'found') throw new Error('The meeting changed while building the layout. Submit your goal again.')
      const validated = validateMeetingComposition(composition, { ...compositionInput, preparation: current.value })
      if (!validated.success) throw new Error('Supporting records changed while building the layout. Try again.')
      const response = serializeMeetingComposition(composition)
      if (!validLayout(response)) throw new Error('The meeting layout could not be validated.')
      previousIntent.current = intent; previousRequestId.current = payload.requestId; previousComposition.current = composition; question.current = null; setClarification(null)
      return { kind: 'meeting', session: { version: 2, kind: 'meeting', taskFilters: emptyFilters(), meetingId: intent.meetingId, intent, composition, response } }
    } catch (failure) {
      if (active()) setError(failure instanceof Error ? failure.message : 'Unable to build your workspace.')
      return null
    } finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  function restore(context?: SuccessfulContinuation, pendingQuestion?: Clarification) {
    previousIntent.current = context?.intent
    previousRequestId.current = context?.requestId
    const usage = usageCompositionSchema.safeParse(context?.composition)
    previousUsageComposition.current = usage.success ? usage.data : undefined
    const meeting = meetingCompositionSchema.safeParse(context?.composition)
    previousComposition.current = meeting.success ? meeting.data : undefined
    question.current = pendingQuestion ?? null
    setClarification(pendingQuestion ?? null)
  }
  function getContinuation(goal: string, targets: string[]): SuccessfulContinuation | undefined {
    if (!previousIntent.current || !previousRequestId.current) return undefined
    return { requestId: previousRequestId.current, goal, targetInstanceIds: targets, provider: 'demo', referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', intent: previousIntent.current, composition: previousIntent.current.goalType === 'usage_investigation' ? previousUsageComposition.current : previousIntent.current.goalType === 'meeting_preparation' ? previousComposition.current : undefined }
  }
  return { restore, getContinuation, pending, error, setError, clarification, run, cancel, reset, getOutcome: () => ({ error: lastError.current, clarification: question.current }) }
}
