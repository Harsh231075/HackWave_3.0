import { test } from 'node:test'
import assert from 'node:assert/strict'
import { intentRequestSchema, intentResolutionSchema, validateIntentResolution, type IntentRequest } from '../src/domain/intent.ts'
import { createIntentService } from '../src/services/intentService.ts'
import { ServiceError } from '../src/services/serviceErrors.ts'

const request = (): IntentRequest => ({
  version: 1, requestId: 'request-1', goal: 'Prepare tomorrow’s meeting', referenceDate: '2026-10-12', timezone: 'Asia/Kolkata',
  candidates: {
    clients: [{ id: 'northstar', label: 'Northstar' }, { id: 'other', label: 'Other client' }],
    projects: [{ id: 'atlas', label: 'Atlas', clientId: 'northstar' }, { id: 'other-project', label: 'Other project', clientId: 'other' }],
    meetings: [{ id: 'meeting-1', label: 'Planning', date: '2026-10-13', clientId: 'northstar', projectId: 'atlas' }, { id: 'meeting-2', label: 'Review', date: '2026-10-13', clientId: 'other' }],
  },
})
const resolved = () => ({ version: 1, requestId: 'request-1', originalGoal: request().goal, status: 'resolved' as const,
  intent: { goalType: 'meeting_preparation' as const, meetingId: 'meeting-1', clientId: 'northstar', projectId: 'atlas', dateRange: { from: '2026-10-13', to: '2026-10-13' } },
})
const clarification = () => ({ version: 1, requestId: 'request-1', originalGoal: request().goal, status: 'needs_clarification' as const,
  field: 'meetingId' as const, question: 'Which meeting?', choices: request().candidates.meetings.map(({ id, label }) => ({ id, label })), partialIntent: { goalType: 'meeting_preparation' as const },
})
test('all supported goals and response statuses validate', () => {
  const meeting = resolved()
  assert.equal(validateIntentResolution(meeting, request()).success, true)
  for (const intent of [
    { goalType: 'usage_investigation', clientId: 'northstar', dateRange: meeting.intent.dateRange },
    { goalType: 'overdue_review', projectId: 'atlas', dateRange: meeting.intent.dateRange, constraints: { status: 'blocked', priority: 'urgent', ownerId: 'maya' } },
  ]) assert.equal(validateIntentResolution({ ...meeting, intent }, request()).success, true)
  assert.equal(validateIntentResolution(clarification(), request()).success, true)
  assert.equal(validateIntentResolution({ ...clarification(), field: 'dateRange', choices: [] }, request()).success, true)
  assert.equal(validateIntentResolution({ version: 1, requestId: 'request-1', originalGoal: request().goal, status: 'unsupported', reason: 'This goal is not supported yet.' }, request()).success, true)
})
test('requests validate real dates, timezones, strict shapes and goal limits', () => {
  for (const patch of [ { goal: '  ' }, { goal: 'a'.repeat(4001) }, { referenceDate: '2025-02-29' }, { referenceDate: '2026-04-31' }, { timezone: 'Mars/Olympus' }, { extra: true }, { version: 2 } ]) {
    assert.equal(intentRequestSchema.safeParse({ ...request(), ...patch }).success, false, JSON.stringify(patch).slice(0, 100))
  }
  assert.equal(intentRequestSchema.safeParse({ ...request(), referenceDate: '2024-02-29' }).success, true)
  for (const dateRange of [{ from: '2026-10-14', to: '2026-10-13' }, { from: '2026-02-30', to: '2026-03-01' }]) {
    assert.equal(intentResolutionSchema.safeParse({ ...resolved(), intent: { ...resolved().intent, dateRange } }).success, false)
  }
})
test('missing scope, unknown enums and nested extra properties are rejected', () => {
  for (const intent of [
    { goalType: 'meeting_preparation', dateRange: resolved().intent.dateRange },
    { goalType: 'usage_investigation', dateRange: resolved().intent.dateRange },
    { goalType: 'overdue_review', dateRange: resolved().intent.dateRange },
    { ...resolved().intent, goalType: 'invented' },
    { ...resolved().intent, extra: true },
    { ...resolved().intent, constraints: { status: 'overdue' } },
    { ...resolved().intent, constraints: { priority: 'critical' } },
  ]) assert.equal(intentResolutionSchema.safeParse({ ...resolved(), intent }).success, false)
  assert.equal(intentResolutionSchema.safeParse({ ...resolved(), status: 'pending' }).success, false)
})
test('candidate catalogs reject duplicate IDs, dangling links and contradictory client links', () => {
  for (const kind of ['clients', 'projects', 'meetings'] as const) {
    const input = request(); input.candidates[kind].push(input.candidates[kind][0] as never)
    assert.equal(intentRequestSchema.safeParse(input).success, false)
  }
  for (const patch of [{ clientId: 'missing' }, { projectId: 'missing' }, { clientId: 'other' }]) {
    const input = request(); Object.assign(input.candidates.meetings[0], patch)
    assert.equal(intentRequestSchema.safeParse(input).success, false)
  }
  const input = request(); input.candidates.projects[0].clientId = 'missing'
  assert.equal(intentRequestSchema.safeParse(input).success, false)
})
test('response references must belong to this request and agree with entity relationships', () => {
  for (const patch of [{ meetingId: 'missing' }, { clientId: 'missing' }, { projectId: 'missing' }, { clientId: 'other' }, { projectId: 'other-project' }]) {
    assert.equal(validateIntentResolution({ ...resolved(), intent: { ...resolved().intent, ...patch } }, request()).success, false)
  }
  assert.equal(validateIntentResolution({ ...resolved(), requestId: 'older' }, request()).success, false)
  assert.equal(validateIntentResolution({ ...resolved(), originalGoal: 'Another goal' }, request()).success, false)
  const input = request(); delete input.candidates.meetings[0].clientId
  assert.equal(validateIntentResolution({ ...resolved(), intent: { ...resolved().intent, clientId: 'other' } }, input).success, false)
})
test('clarification choices match the catalog and partial/previous intents are validated', () => {
  const response = clarification()
  for (const choices of [[], [response.choices[0]], [response.choices[0], response.choices[0]], [{ id: 'atlas', label: 'Atlas' }, response.choices[1]], [{ id: 'meeting-1', label: 'Invented' }, response.choices[1]]]) {
    assert.equal(validateIntentResolution({ ...response, choices }, request()).success, false)
  }
  assert.equal(validateIntentResolution({ ...response, field: 'dateRange' }, request()).success, false)
  assert.equal(validateIntentResolution({ ...response, partialIntent: { clientId: 'missing' } }, request()).success, false)
  assert.equal(intentRequestSchema.safeParse({ ...request(), previousIntent: { ...resolved().intent, meetingId: 'missing' } }).success, false)
  const answer = { requestId: 'older-question', originalGoal: request().goal, field: 'meetingId', selectedId: 'meeting-1' }
  const clarificationContext = { requestId: 'older-question', originalGoal: request().goal, field: 'meetingId', choices: clarification().choices, partialIntent: clarification().partialIntent }
  assert.equal(intentRequestSchema.safeParse({ ...request(), clarificationAnswer: answer, clarificationContext }).success, true)
  assert.equal(intentRequestSchema.safeParse({ ...request(), clarificationAnswer: { ...answer, selectedId: 'atlas' } }).success, false)
})
test('service normalizes payload, forwards cancellation and does not mutate input', async () => {
  const input = request(); input.goal = `  ${input.goal}  `
  const before = structuredClone(input)
  const controller = new AbortController()
  const service = createIntentService(async (payload, options) => {
    assert.equal(payload.goal, request().goal)
    assert.equal(options?.signal, controller.signal)
    assert.notEqual(payload.candidates, input.candidates)
    return resolved()
  })
  assert.equal((await service.resolve(input, { signal: controller.signal })).status, 'resolved')
  assert.deepEqual(input, before)
})
test('service rejects invalid input before invoking resolver and invalid responses afterward', async () => {
  let calls = 0
  const service = createIntentService(async () => { calls++; return { ...resolved(), requestId: 'wrong' } })
  await assert.rejects(service.resolve({ ...request(), goal: '' }), (error: unknown) => error instanceof ServiceError && error.code === 'input')
  assert.equal(calls, 0)
  await assert.rejects(service.resolve(request()), (error: unknown) => error instanceof ServiceError && error.code === 'response')
  assert.equal(calls, 1)
})
test('service preserves adapter failures and aborts, including cancellation during resolution', async () => {
  const failure = new ServiceError('network', 'Offline')
  await assert.rejects(createIntentService(async () => { throw failure }).resolve(request()), error => error === failure)
  const abort = new DOMException('Cancelled', 'AbortError')
  await assert.rejects(createIntentService(async () => { throw abort }).resolve(request()), error => error === abort)
  const controller = new AbortController(); controller.abort(abort)
  let calls = 0
  await assert.rejects(createIntentService(async () => { calls++; return resolved() }).resolve(request(), { signal: controller.signal }), error => error === abort)
  assert.equal(calls, 0)
  const during = new AbortController()
  await assert.rejects(createIntentService(async () => { during.abort(abort); return resolved() }).resolve(request(), { signal: during.signal }), error => error === abort)
})
