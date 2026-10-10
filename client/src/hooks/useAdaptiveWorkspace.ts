import { useCallback, useEffect, useRef, useState } from 'react'
import { candidateCatalogService, intentService, meetingPreparationService, meetingCompositionService, generationService } from '@/services'
import { DEMO_DATE } from '@/data/demo'
import { repairOpenUI, validLayout } from '@/lib/workspace/layoutValidation'
import { serializeMeetingComposition, validateMeetingComposition, type MeetingComposition } from '@/domain/adaptiveData'
import { intentRequestSchema, type IntentRequest, type IntentResolution, type ResolvedIntent } from '@/domain/intent'
import type { GenerateWorkspaceInput } from '@/services/contracts'
import type { MeetingLayout } from '@/services/layoutService'

export type Clarification = Extract<IntentResolution, { status: 'needs_clarification' }>
export type AdaptiveResult = { kind: 'meeting'; session: MeetingLayout } | { kind: 'general'; response: string }
export function useAdaptiveWorkspace(initialIntent?: ResolvedIntent) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [clarification, setClarification] = useState<Clarification | null>(null)
  const request = useRef<AbortController | null>(null)
  const previousIntent = useRef(initialIntent)
  const previousComposition = useRef<MeetingComposition | undefined>(undefined)
  const question = useRef<Clarification | null>(null)
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; setPending(false); question.current = null; setClarification(null) }, [])
  const reset = () => { cancel(); previousIntent.current = undefined; previousComposition.current = undefined; setError('') }
  useEffect(() => () => request.current?.abort(), [])
  async function run(input: GenerateWorkspaceInput, answer?: IntentRequest['clarificationAnswer']): Promise<AdaptiveResult | null> {
    request.current?.abort()
    const controller = new AbortController(); request.current = controller
    const active = () => request.current === controller && !controller.signal.aborted
    setPending(true); setError('')
    try {
      const catalog = candidateCatalogService.load()
      if (catalog.status !== 'found') throw new Error('Saved meeting data is invalid and has been preserved. Choose another view or repair the saved data.')
      const offered = answer ? question.current : null
      if (answer && !offered) throw new Error('This question is no longer active. Submit your goal again.')
      if (!answer) { question.current = null; setClarification(null) }
      const originalGoal = offered?.originalGoal ?? input.goal.trim()
      const payload: IntentRequest = {
        version: 1, requestId: crypto.randomUUID(), goal: originalGoal, referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', candidates: catalog.value,
        ...(previousIntent.current ? { previousIntent: previousIntent.current } : {}),
        ...(answer && offered ? { clarificationAnswer: answer, clarificationContext: { requestId: offered.requestId, originalGoal: offered.originalGoal, field: offered.field, choices: offered.choices, partialIntent: offered.partialIntent } } : {}),
      }
      if (payload.previousIntent && !intentRequestSchema.safeParse({ ...payload, clarificationAnswer: undefined, clarificationContext: undefined }).success) delete payload.previousIntent
      const resolution = await intentService.resolve(payload, { signal: controller.signal })
      if (!active()) return null
      if (resolution.status === 'unsupported') { question.current = null; setClarification(null); setError(resolution.reason); return null }
      if (resolution.status === 'needs_clarification') { question.current = resolution; setClarification(resolution); return null }
      const intent = resolution.intent
      if (intent.goalType !== 'meeting_preparation' || !intent.meetingId) {
        const output = await generationService.generate({ ...input, goal: originalGoal }, { signal: controller.signal })
        if (!active()) return null
        const response = repairOpenUI(output.response)
        if (!validLayout(response)) throw new Error('The generated layout could not be validated. Try again.')
        previousIntent.current = intent; previousComposition.current = undefined; question.current = null; setClarification(null)
        return { kind: 'general', response }
      }
      const preparation = meetingPreparationService.load(intent.meetingId)
      if (preparation.status !== 'found') throw new Error('This meeting is no longer available. Submit your goal again.')
      const key = `meeting-agenda:${intent.meetingId}`
      const compositionInput = { version: 1 as const, requestId: payload.requestId, intent, preparation: preparation.value,
        agenda: input.context.drafts[key] ?? preparation.value.meeting.agenda,
        ...(previousIntent.current?.meetingId === intent.meetingId && previousComposition.current ? { previousComposition: previousComposition.current } : {}),
      }
      const composition = await meetingCompositionService.compose(compositionInput, { signal: controller.signal })
      if (!active()) return null
      const current = meetingPreparationService.load(intent.meetingId)
      if (current.status !== 'found') throw new Error('The meeting changed while building the layout. Submit your goal again.')
      const validated = validateMeetingComposition(composition, { ...compositionInput, preparation: current.value })
      if (!validated.success) throw new Error('Supporting records changed while building the layout. Try again.')
      const response = serializeMeetingComposition(composition)
      if (!validLayout(response)) throw new Error('The meeting layout could not be validated.')
      previousIntent.current = intent; previousComposition.current = composition; question.current = null; setClarification(null)
      return { kind: 'meeting', session: { version: 2, kind: 'meeting', meetingId: intent.meetingId, intent, composition, response } }
    } catch (failure) {
      if (active()) setError(failure instanceof Error ? failure.message : 'Unable to prepare your meeting.')
      return null
    } finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  return { pending, error, setError, clarification, run, cancel, reset }
}
