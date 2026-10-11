import { test } from 'node:test'
import assert from 'node:assert/strict'
import { continuationChangeSchema } from '../src/domain/intentChanges.ts'
import { applyIntentContinuity } from '../src/domain/intentContinuity.ts'
import { componentViewSchema } from '../src/domain/componentIntent.ts'
import { applyComponentView } from '../src/domain/instanceViews.ts'
import { emptyWorkspace, commitWorkspace, workspaceDocumentSchema, TargetError } from '../src/domain/workspaceDocument.ts'
import { makeInstance } from '../src/domain/widgetInstances.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createWorkspaceDocumentService } from '../src/services/workspaceDocumentService.ts'
import { createWorkspaceDocumentStore } from '../src/services/workspaceDocumentStore.ts'
import { validateSavedContinuation } from '../src/services/continuationService.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES, DEMO_DATE } from './fixtures/demo.ts'
import type { IntentRequest, ResolvedIntent } from '../src/domain/intent.ts'
import type { IntentChanges } from '../src/domain/intentChanges.ts'

const overdue: ResolvedIntent = { goalType: 'overdue_review', clientId: 'northstar', projectId: 'atlas', dateRange: { from: '0001-01-01', to: '2026-10-11' } }
const candidates = {
  clients: ADAPTIVE_DEMO.clients.map(c => ({ id: c.id, label: c.name })),
  projects: ADAPTIVE_DEMO.projects.map(p => ({ id: p.id, label: p.name, clientId: p.clientId })),
  meetings: ADAPTIVE_DEMO.meetings.map(m => ({ id: m.id, label: m.title, date: m.date, clientId: m.clientId, projectId: m.projectId })),
}
const request: IntentRequest = { version: 1, requestId: 'next', goal: 'Only blocked items', referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', candidates, previousIntent: overdue, followUpOf: 'first' }
const refinement = (changes: IntentChanges) => ({ relationship: 'refinement' as const, targetInstanceIds: [], changes })
function patch(changes: IntentChanges, widgets: string[] = ['tasks']) {
  return componentViewSchema.parse({ action: 'view', widgets, bindings: {}, referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', reply: 'Updated selection.', continuation: refinement(changes) })
}
function response(intent = overdue) { return { version: 1, requestId: 'next', originalGoal: request.goal, status: 'resolved', intent } }
function setup() {
  const values = new Map<string, string>()
  let writes = 0
  const storage = createBrowserStorage(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes++; values.set(key, value) }, removeItem: key => { values.delete(key) } }))
  const database = createBrowserDatabase(storage, { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }, { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES })
  return { database, storage, values, writes: () => writes }
}
test('change contracts reject unknown fields and malformed set/clear patches', () => {
  assert.equal(continuationChangeSchema.safeParse(refinement({ status: { operation: 'set', value: 'blocked' } })).success, true)
  assert.equal(continuationChangeSchema.safeParse({ ...refinement({}), changes: { status: { operation: 'clear', value: 'blocked' } } }).success, false)
  assert.equal(continuationChangeSchema.safeParse({ ...refinement({}), changes: { handler: 'eval' } }).success, false)
})
test('adaptive refinements inherit scope and accumulate constraints rather than replacing intent', () => {
  const blocked = applyIntentContinuity(response({ ...overdue, projectId: 'launch', clientId: 'westbridge' }), { ...request, continuation: refinement({ status: { operation: 'set', value: 'blocked' } }) }) as ReturnType<typeof response>
  assert.equal(blocked.intent.projectId, 'atlas')
  assert.equal(blocked.intent.constraints?.status, 'blocked')
  const high = applyIntentContinuity(response(), { ...request, previousIntent: blocked.intent, continuation: refinement({ priority: { operation: 'set', value: 'high' } }) }) as ReturnType<typeof response>
  assert.deepEqual(high.intent.constraints, { status: 'blocked', priority: 'high' })
  const all = applyIntentContinuity(response(), { ...request, previousIntent: high.intent, continuation: refinement({ status: { operation: 'clear' } }) }) as ReturnType<typeof response>
  assert.deepEqual(all.intent.constraints, { priority: 'high' })
  assert.deepEqual(all.intent.dateRange, overdue.dateRange)
})
test('switching project derives its client and a new goal does not inherit prior scope', () => {
  const switched = applyIntentContinuity(response(), { ...request, continuation: refinement({ projectId: { operation: 'set', value: 'launch' } }) }) as ReturnType<typeof response>
  assert.equal(switched.intent.clientId, 'westbridge')
  assert.equal(switched.intent.projectId, 'launch')
  const next = response({ ...overdue, clientId: 'westbridge', projectId: 'launch' })
  assert.deepEqual(applyIntentContinuity(next, { ...request, continuation: { relationship: 'new_goal', targetInstanceIds: [], changes: {} } }), next)
})
test('clearing required dates clarifies; unsupported adaptive fields never install a view', () => {
  const cleared = applyIntentContinuity(response(), { ...request, continuation: refinement({ dateRange: { operation: 'clear' } }) }) as { status: string; field: string }
  assert.equal(cleared.status, 'needs_clarification'); assert.equal(cleared.field, 'dateRange')
  const unsupported = applyIntentContinuity(response(), { ...request, continuation: refinement({ owner: { operation: 'set', value: 'Maya' } }) }) as { status: string }
  assert.equal(unsupported.status, 'unsupported')
})
test('bounded local overdue paraphrases retain dates and project', () => {
  for (const goal of ['Only blocked tasks', 'Only blocked items', 'Just the blocked work']) {
    const result = applyIntentContinuity(response(), { ...request, goal }) as ReturnType<typeof response>
    assert.equal(result.intent.projectId, 'atlas'); assert.equal(result.intent.constraints?.status, 'blocked')
  }
})
test('component patches clear optional state and preserve omitted filters', () => {
  const instance = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas', clientId: 'northstar' }, { owner: 'Maya', taskFilters: { query: '', status: 'blocked', priority: 'high', sort: 'due', from: '2026-10-01', to: '2026-10-11' } }, 'atlas-view')
  const next = applyComponentView({ ...emptyWorkspace(), active: [instance] }, patch({ priority: { operation: 'clear' }, owner: { operation: 'clear' } }), 'Any priority')
  assert.equal(next.active[0].viewState.taskFilters.status, 'blocked')
  assert.equal(next.active[0].viewState.taskFilters.priority, 'all')
  assert.equal(next.active[0].viewState.owner, undefined)
  assert.equal(next.active[0].binding.kind, 'workspace')
})
test('ambiguous views clarify and explicit targeting changes only one instance', () => {
  const first = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas' }, {}, 'atlas-view'), second = makeInstance('tasks', { kind: 'workspace', projectId: 'launch' }, {}, 'launch-view')
  const document = { ...emptyWorkspace(), active: [first, second] }
  assert.throws(() => applyComponentView(document, patch({ status: { operation: 'set', value: 'blocked' } }), 'Only blocked'), TargetError)
  const next = applyComponentView(document, patch({ status: { operation: 'set', value: 'blocked' } }), 'Only blocked', undefined, first.instanceId)
  assert.equal(next.active[0].viewState.taskFilters.status, 'blocked')
  assert.deepEqual(next.active[1], second)
})
test('pins are not implicit targets; explicit scope changes create active views', () => {
  const original = { ...makeInstance('tasks', { kind: 'workspace', clientId: 'northstar', projectId: 'atlas' }, {}, 'pinned-atlas'), pinId: 'pin', createdAt: new Date().toISOString() }
  const document = { ...emptyWorkspace(), pins: [original] }
  const next = applyComponentView(document, patch({ projectId: { operation: 'set', value: 'launch' } }), 'Launch instead', undefined, original.instanceId, candidates.projects)
  assert.deepEqual(next.pins[0], original)
  assert.equal(next.active[0].binding.kind, 'workspace')
  assert.notEqual(next.active[0].instanceId, original.instanceId)
  const filtered = applyComponentView(document, patch({ status: { operation: 'set', value: 'blocked' } }), 'Only blocked', undefined, original.instanceId)
  assert.equal(filtered.pins[0].viewState.taskFilters.status, 'blocked')
  assert.deepEqual(filtered.pins[0].binding, original.binding)
  assert.throws(() => applyComponentView(document, patch({ status: { operation: 'set', value: 'blocked' } }), 'Only blocked'), /existing view/)
})
test('version one migration reads without writes or mutating stored data', () => {
  const { database, values, writes } = setup()
  const legacy = { ...emptyWorkspace(), version: 1, active: [makeInstance('tasks')] }
  database.writeCollection('workspaceDocument', legacy)
  const raw = values.get('orlo-browser-db-v1'), before = writes()
  const service = createWorkspaceDocumentService(database)
  assert.equal(service.initialize().document.version, 2)
  assert.equal(writes(), before); assert.equal(values.get('orlo-browser-db-v1'), raw)
  assert.equal(workspaceDocumentSchema.safeParse({ ...legacy, version: 999 }).success, false)
})
test('shared store initializes once, retains undo and makes no mount writes', () => {
  const { database, writes } = setup(), store = createWorkspaceDocumentStore(database)
  const initial = store.getSnapshot()
  assert.equal(store.getSnapshot(), initial); assert.equal(writes(), 0)
  const context = { requestId: 'first', goal: 'Review Atlas', targetInstanceIds: [initial.document.active[0].instanceId], referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', provider: 'demo' as const, intent: overdue }
  store.save(commitWorkspace(initial.document, { continuation: { lastSuccess: context } }))
  store.save(commitWorkspace(store.getSnapshot().document, { continuation: undefined }))
  store.undo()
  assert.deepEqual(store.getSnapshot().document.continuation?.lastSuccess, context)
})
test('saved target clarification retains proposed patch and rejects removed choices', () => {
  const { database } = setup(), first = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas' }, {}, 'a'), second = makeInstance('tasks', { kind: 'workspace', projectId: 'launch' }, {}, 'b')
  const pending = { kind: 'component' as const, requestId: 'q', goal: 'Only blocked', targetInstanceIds: ['a', 'b'], referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', useDemo: false, question: 'Which tasks?', choices: [{ id: 'a', label: 'Atlas' }, { id: 'b', label: 'Launch' }], proposed: patch({ status: { operation: 'set', value: 'blocked' } }) }
  const document = { ...emptyWorkspace(), active: [first, second], continuation: { pending } }
  const service = createWorkspaceDocumentService(database); assert.equal(service.save(document).status, 'saved')
  assert.deepEqual(service.initialize().document.continuation?.pending, pending)
  assert.equal(validateSavedContinuation(document, database).stale, false)
  assert.equal(validateSavedContinuation({ ...document, active: [first] }, database).stale, true)
})
test('Google continuation is tied to its original account', () => {
  const { database } = setup(), instance = makeInstance('meetings', { kind: 'google-calendar', calendarId: 'primary', accountId: 'original', mode: 'browse' })
  const document = { ...emptyWorkspace(), active: [instance], continuation: { lastSuccess: { requestId: 'first', goal: 'Meetings', targetInstanceIds: [instance.instanceId], referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', provider: 'google-calendar' as const, accountId: 'original' } } }
  assert.equal(validateSavedContinuation(document, database, 'other').lastSuccess, undefined)
  assert.ok(validateSavedContinuation(document, database, 'original').lastSuccess)
})
test('safe normalization expands grouped filter patches and clears both status representations', async () => {
  const { normalizeModelIntent } = await import('./componentModelIntent.ts')
  const { validateComponentResolution, fallbackComponentIntent } = await import('../src/domain/componentIntent.ts')
  const input = { goal: 'Only blocked items', referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', previous: componentViewSchema.parse({ action: 'view', widgets: ['tasks'], bindings: {}, referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', reply: 'Previous' }), catalog: { owners: ['Maya'], clients: ADAPTIVE_DEMO.clients, projects: ADAPTIVE_DEMO.projects, topics: [], draftKeys: [] } }
  const value = { ...patch({}), continuation: { relationship: 'refinement', targetInstanceIds: [], changes: { taskFilters: { operation: 'set', value: { status: 'blocked' } } } } }
  const normalized = validateComponentResolution(normalizeModelIntent(value, input), input)
  assert.ok(normalized.success)
  if (normalized.success && normalized.data.action === 'view') assert.deepEqual(normalized.data.continuation?.changes.status, { operation: 'set', value: 'blocked' })
  const all = normalizeModelIntent({ ...patch({}), continuation: { ...refinement({}), changes: { taskStatuses: { operation: 'clear' } } } }, input) as { continuation: { changes: IntentChanges } }
  assert.deepEqual(all.continuation.changes.status, { operation: 'clear' })
  const local = fallbackComponentIntent(input)
  assert.equal(local.action, 'view')
  if (local.action === 'view') assert.deepEqual(local.continuation?.changes.status, { operation: 'set', value: 'blocked' })
  const invalid = { ...value, continuation: { ...value.continuation, changes: { taskFilters: { operation: 'set', value: { execute: 'bad' } } } } }
  assert.equal(validateComponentResolution(normalizeModelIntent(invalid, input), input).success, false)
})
test('changed target state invalidates pending clarification even when its ID survives', async () => {
  const { fingerprint } = await import('../src/domain/widgetInstances.ts')
  const { database } = setup(), target = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas' }, {}, 'a')
  const pending = { kind: 'component' as const, requestId: 'q', goal: 'Only blocked', targetInstanceIds: ['a'], targetSignatures: { a: fingerprint({ binding: target.binding, viewState: target.viewState }) }, referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', useDemo: false, question: 'Which tasks?', choices: [{ id: 'a', label: 'Atlas' }], proposed: patch({ status: { operation: 'set', value: 'blocked' } }) }
  const document = { ...emptyWorkspace(), active: [target], continuation: { pending } }
  assert.ok(validateSavedContinuation(document, database).pending)
  const changed = { ...target, viewState: { ...target.viewState, owner: 'Maya' } }
  assert.equal(validateSavedContinuation({ ...document, active: [changed] }, database).pending, undefined)
})
test('meeting date refinements resolve the matching meeting and inherit its ownership', () => {
  const first = candidates.meetings.find(m => m.id === 'northstar-meeting')!
  const previous: ResolvedIntent = { goalType: 'meeting_preparation', meetingId: first.id, projectId: first.projectId, clientId: first.clientId, dateRange: { from: first.date, to: first.date } }
  const sameDate = applyIntentContinuity(response(previous), { ...request, previousIntent: previous, continuation: refinement({ dateRange: { operation: 'set', value: { from: first.date, to: first.date } } }) }) as ReturnType<typeof response>
  assert.equal(sameDate.intent.meetingId, first.id)
  const second = candidates.meetings.find(m => m.id === 'westbridge-meeting')!
  const switched = applyIntentContinuity(response(previous), { ...request, previousIntent: previous, continuation: refinement({ meetingId: { operation: 'set', value: second.id } }) }) as ReturnType<typeof response>
  assert.equal(switched.intent.clientId, second.clientId)
  assert.equal(switched.intent.projectId, second.projectId)
  assert.deepEqual(switched.intent.dateRange, { from: second.date, to: second.date })
})
test('usage refinements preserve scope and explicit segment clear removes only the segment', () => {
  const usage: ResolvedIntent = { ...overdue, goalType: 'usage_investigation', constraints: { segment: 'web' } }
  const result = applyIntentContinuity(response(usage), { ...request, previousIntent: usage, continuation: refinement({ segment: { operation: 'set', value: 'mobile' } }) }) as ReturnType<typeof response>
  assert.equal(result.intent.constraints?.segment, 'mobile')
  assert.equal(result.intent.projectId, 'atlas')
  const cleared = applyIntentContinuity(response(usage), { ...request, previousIntent: result.intent, continuation: refinement({ segment: { operation: 'clear' } }) }) as ReturnType<typeof response>
  assert.equal(cleared.intent.constraints?.segment, undefined)
  assert.equal(cleared.intent.clientId, 'northstar')
  assert.deepEqual(cleared.intent.dateRange, usage.dateRange)
})
test('interruption never restarts a request and preserves the last successful context', () => {
  const { database } = setup(), store = createWorkspaceDocumentStore(database), initial = store.getSnapshot().document
  const context = { requestId: 'first', goal: 'Review Atlas', targetInstanceIds: [], referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', provider: 'demo' as const, intent: overdue }
  store.save({ ...initial, continuation: { lastSuccess: context }, turns: [{ id: 'running', prompt: 'Only blocked', reply: 'Working', status: 'pending' }] }, false)
  store.interrupt('running')
  assert.equal(store.getSnapshot().document.turns[0].status, 'cancelled')
  assert.deepEqual(store.getSnapshot().document.continuation?.lastSuccess, context)
})
test('pin scope switches at capacity fail without mutating the original document', async () => {
  const { widgetTypes } = await import('../src/lib/workspace/config.ts')
  const pin = { ...makeInstance('tasks', { kind: 'workspace', projectId: 'atlas', clientId: 'northstar' }, {}, 'pinned'), pinId: 'pin', createdAt: new Date().toISOString() }
  const document = { ...emptyWorkspace(), pins: [pin], active: widgetTypes.slice(0, 13).map((type, index) => makeInstance(type, { kind: 'workspace' }, {}, 'view-' + index)) }
  const snapshot = structuredClone(document)
  assert.throws(() => applyComponentView(document, patch({ projectId: { operation: 'set', value: 'launch' } }), 'Launch instead', undefined, pin.instanceId, candidates.projects), /at most/)
  assert.deepEqual(document, snapshot)
})
test('compatible presentation refinements retain working action buttons', () => {
  const target = { ...makeInstance('tasks', { kind: 'workspace' }, {}, 'tasks'), actions: [{ label: 'Edit task', action: { type: 'task.edit' as const, taskId: 'task-3' } }] }
  const next = applyComponentView({ ...emptyWorkspace(), active: [target] }, patch({ taskView: { operation: 'set', value: 'kanban' } }), 'Kanban instead')
  assert.deepEqual(next.active[0].actions, target.actions)
  assert.equal(next.active[0].viewState.taskView, 'kanban')
})
test('explicit multi-target presentation refinements update every selected view only', () => {
  const first = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas' }, {}, 'a'), second = makeInstance('tasks', { kind: 'workspace', projectId: 'launch' }, {}, 'b'), third = makeInstance('tasks', { kind: 'workspace' }, {}, 'c')
  const plan = patch({ taskView: { operation: 'set', value: 'kanban' } })
  plan.continuation!.targetInstanceIds = ['a', 'b']
  const next = applyComponentView({ ...emptyWorkspace(), active: [first, second, third] }, plan, 'Both in Kanban')
  assert.equal(next.active[0].viewState.taskView, 'kanban'); assert.equal(next.active[1].viewState.taskView, 'kanban')
  assert.deepEqual(next.active[2], third)
  assert.deepEqual(next.targets, ['a', 'b'])
})
