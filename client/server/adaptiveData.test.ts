import { emptyFilters, filterTasks } from '../src/domain/workspace.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { ADAPTIVE_DEMO } from '../src/data/adaptiveDemo.ts'
import { intentRequestSchema, validateIntentResolution } from '../src/domain/intent.ts'
import { validateMeetingComposition, serializeMeetingComposition, type ComposeRequest } from '../src/domain/adaptiveData.ts'
import { createLayoutService, layoutStorageKey, meetingLayoutSchema, retainMeetingTaskFilters } from '../src/services/layoutService.ts'
import { createTaskService } from '../src/services/taskService.ts'
import { createDraftService } from '../src/services/draftService.ts'

function setup() {
  const values = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } }))
  const seed = { tasks: ['task-2', 'task-3', 'task-4', 'task-5', 'task-6'].map(id => ({ id, title: id, description: '', owner: 'Maya', due: '2026-10-13', duration: 30, priority: 'medium' as const, status: 'pending' as const })), events: [{ id: 'northstar-meeting', title: 'Northstar planning meeting', date: '2026-10-13', start: '10:00', end: '11:00', category: 'meeting' as const, participants: ['Maya'], agenda: 'Prepare agenda' }], drafts: {}, dismissed: [], activity: [] }
  const collections = { ...ADAPTIVE_DEMO, resources: ['meeting-notes', 'usage-evidence', 'project-brief'].map(id => ({ id, title: id, kind: 'Reference', context: '', body: 'Evidence' })) }
  const database = createBrowserDatabase(storage, seed, collections)
  const service = createAdaptiveDataService(database)
  return { values, storage, seed, collections, database, service }
}
function compositionInput(): ComposeRequest {
  const { service } = setup(); const loaded = service.loadPreparation('northstar-meeting'); assert.equal(loaded.status, 'found'); if (loaded.status !== 'found') throw new Error('missing fixture')
  return { version: 1, requestId: 'request', intent: { goalType: 'meeting_preparation', meetingId: 'northstar-meeting', clientId: 'northstar', projectId: 'atlas', dateRange: { from: '2026-10-13', to: '2026-10-13' } }, preparation: loaded.value, agenda: 'Agenda' }
}
const plan = () => ({ version: 1 as const, requestId: 'request', widgets: ['context', 'outline', 'tasks'].map(type => ({ type: type as 'context' | 'outline' | 'tasks', span: 'full' as const, reason: 'Selected meeting records.', evidence: [{ kind: 'meeting' as const, id: 'northstar-meeting' }] })) })
test('fresh linked collections provide two tomorrow meetings without initialization writes', () => {
  const { service, values } = setup(); const result = service.loadCandidates()
  assert.equal(result.status, 'found'); if (result.status !== 'found') return
  assert.equal(result.value.meetings.filter(meeting => meeting.date === '2026-10-13').length, 2)
  assert.equal(result.value.clients.length, 2); assert.equal(result.value.projects.length, 2)
  assert.equal(values.size, 0)
  result.value.clients[0].label = 'Changed'
  const fresh = service.loadCandidates(); assert.equal(fresh.status === 'found' && fresh.value.clients[0].label, 'Northstar')
})
test('preparation retrieval excludes other clients, closed issues and duplicate task links', () => {
  const { service } = setup(); const result = service.loadPreparation('northstar-meeting')
  assert.equal(result.status, 'found'); if (result.status !== 'found') return
  assert.deepEqual(result.value.tasks.map(task => task.id), ['task-3', 'task-4', 'task-5'])
  assert.deepEqual(result.value.resources.map(resource => resource.id), ['meeting-notes', 'usage-evidence'])
  assert.equal(result.value.previousMeeting?.id, 'northstar-previous')
  assert.deepEqual(result.value.issues.map(issue => issue.id), ['northstar-onboarding'])
  assert.ok(result.value.communications.every(item => item.clientId === 'northstar'))
  assert.equal(result.value.meeting.agenda, 'Prepare agenda')
})
test('event edits update candidates; deletion excludes the meeting without resurrecting it', () => {
  const { service, database } = setup(); const event = database.getState().events[0]
  database.dispatch({ type: 'event', event: { ...event, date: '2026-10-15', start: '12:00', end: '13:00' } })
  const edited = service.loadCandidates(); assert.equal(edited.status === 'found' && edited.value.meetings.find(item => item.id === event.id)?.date, '2026-10-15')
  database.dispatch({ type: 'delete-event', id: event.id })
  assert.equal(service.loadPreparation(event.id).status, 'missing')
  const deleted = service.loadCandidates(); assert.equal(deleted.status === 'found' && deleted.value.meetings.some(item => item.id === event.id), false)
})
test('malformed collections and existing empty projects are preserved and not reseeded', () => {
  const { database, service, values } = setup()
  database.writeCollection('projects', [])
  assert.equal(service.loadPreparation('northstar-meeting').status, 'missing')
  const stored = values.get('orlo-browser-db-v1')
  service.loadCandidates(); assert.equal(values.get('orlo-browser-db-v1'), stored)
  database.writeCollection('communications', { broken: true })
  assert.equal(service.loadCandidates().status, 'invalid')
  assert.equal(service.communications.create({ clientId: 'northstar', projectId: 'atlas', date: '2026-10-12', sender: 'Maya', subject: 'Note', body: '' }).ok, false)
})
test('CRUD validates references, links do not cascade deletes, and dangling links are excluded', () => {
  const { service, database } = setup()
  assert.equal(service.issues.update('northstar-onboarding', { clientId: 'westbridge' }).ok, false)
  assert.equal(service.meetings.update('northstar-meeting', { eventId: 'missing' }).ok, false)
  assert.equal(service.relationships.create({ sourceKind: 'project', sourceId: 'missing', targetKind: 'task', targetId: 'task-3', type: 'related' }).ok, false)
  assert.equal(service.relationships.delete('atlas-task-3').ok, true)
  assert.ok(database.getState().tasks.some(task => task.id === 'task-3'))
  database.dispatch({ type: 'delete-task', id: 'task-4' })
  const result = service.loadPreparation('northstar-meeting'); assert.equal(result.status === 'found' && result.value.tasks.some(task => task.id === 'task-4'), false)
  assert.equal(service.relationships.getById('atlas-task-4')?.targetId, 'task-4')
  assert.equal(service.projects.delete('atlas').ok, true)
  assert.equal(service.loadPreparation('northstar-meeting').status, 'missing')
})
test('communications are limited and sorted, and shared domain edits and scoped drafts persist', () => {
  const { service, database, storage, seed, collections } = setup()
  for (let i = 0; i < 12; i++) assert.equal(service.communications.create({ clientId: 'northstar', projectId: 'atlas', date: '2026-10-12', sender: 'Maya', subject: `Update ${i}`, body: '' }).ok, true)
  const data = service.loadPreparation('northstar-meeting'); assert.equal(data.status === 'found' && data.value.communications.length, 10)
  const tasks = createTaskService(database, () => '2026-10-12'); tasks.toggle('task-3')
  const drafts = createDraftService(database); drafts.save('meeting-agenda:northstar-meeting', 'Northstar notes'); drafts.save('meeting-agenda:westbridge-meeting', 'Westbridge notes')
  const restored = createBrowserDatabase(storage, seed, collections)
  assert.equal(restored.getState().tasks.find(task => task.id === 'task-3')?.status, 'completed')
  assert.equal(restored.getState().drafts['meeting-agenda:northstar-meeting'], 'Northstar notes')
  assert.equal(restored.getState().drafts['meeting-agenda:westbridge-meeting'], 'Westbridge notes')
})
test('clarification requires the offered context, validates date answers, and rejects incompatible scope', () => {
  const catalog = setup().service.loadCandidates(); assert.equal(catalog.status, 'found'); if (catalog.status !== 'found') return
  const choices = catalog.value.meetings.filter(item => item.date === '2026-10-13').map(({ id, label }) => ({ id, label }))
  const request = { version: 1 as const, requestId: 'r', goal: 'Prepare tomorrow’s meeting', referenceDate: '2026-10-12', timezone: 'Asia/Kolkata', candidates: catalog.value }
  const context = { requestId: 'q', originalGoal: request.goal, field: 'meetingId' as const, choices, partialIntent: { goalType: 'meeting_preparation' as const } }
  const answer = { requestId: 'q', originalGoal: request.goal, field: 'meetingId' as const, selectedId: 'northstar-meeting' }
  assert.equal(intentRequestSchema.safeParse({ ...request, clarificationAnswer: answer }).success, false)
  assert.equal(intentRequestSchema.safeParse({ ...request, clarificationContext: context, clarificationAnswer: answer }).success, true)
  assert.equal(intentRequestSchema.safeParse({ ...request, clarificationContext: context, clarificationAnswer: { ...answer, requestId: 'old' } }).success, false)
  const dateRequest = { ...request, clarificationContext: { ...context, field: 'dateRange', choices: [] }, clarificationAnswer: { requestId: 'q', originalGoal: request.goal, field: 'dateRange', dateRange: { from: '2026-10-13', to: '2026-10-13' } } }
  assert.equal(intentRequestSchema.safeParse(dateRequest).success, true)
  assert.equal(validateIntentResolution({ version: 1, requestId: 'r', originalGoal: request.goal, status: 'needs_clarification', question: 'Which meeting?', field: 'meetingId', choices, partialIntent: { clientId: 'northstar' } }, request).success, false)
})
test('composition rejects invented evidence, duplicate widgets, unsupported spans and mismatched scope', () => {
  const input = compositionInput()
  assert.equal(validateMeetingComposition(plan(), input).success, true)
  for (const invalid of [
    { ...plan(), requestId: 'old' }, { ...plan(), widgets: [plan().widgets[0]] },
    { ...plan(), widgets: [...plan().widgets, plan().widgets[0]] },
    { ...plan(), widgets: plan().widgets.map(widget => ({ ...widget, span: 'huge' })) },
    { ...plan(), widgets: plan().widgets.map(widget => ({ ...widget, evidence: [{ kind: 'task', id: 'task-6' }] })) },
  ]) assert.equal(validateMeetingComposition(invalid, input).success, false)
})
test('layout persists version-2 meeting scope, reads legacy data, and preserves invalid raw data', () => {
  const { storage, values } = setup(); const layout = createLayoutService(storage, response => response.startsWith('root ='))
  const input = compositionInput(), composition = plan(), response = serializeMeetingComposition(composition)
  const session = { version: 2 as const, kind: 'meeting' as const, meetingId: input.preparation.meeting.id, intent: input.intent, composition, response }
  assert.equal(layout.saveMeeting(session).status, 'saved'); assert.deepEqual(layout.loadSession(), { status: 'found', value: { ...session, taskFilters: { query: '', status: 'all', priority: 'all', sort: 'due', from: '', to: '' } } })
  assert.equal(layout.saveMeeting({ ...session, meetingId: 'wrong' }).status, 'invalid'); assert.deepEqual(layout.loadSession(), { status: 'found', value: { ...session, taskFilters: { query: '', status: 'all', priority: 'all', sort: 'due', from: '', to: '' } } })
  layout.save('root = Card([])'); assert.equal(layout.load().status, 'found')
  values.set(layoutStorageKey, '{broken'); assert.equal(layout.loadSession().status, 'invalid'); assert.equal(values.get(layoutStorageKey), '{broken')
})
test('unavailable storage retains additive data and accepted edits in memory', () => {
  const storage = createBrowserStorage(() => { throw new Error('blocked') })
  const { seed, collections } = setup(); const database = createBrowserDatabase(storage, seed, collections), service = createAdaptiveDataService(database)
  assert.equal(service.loadCandidates().status, 'found')
  assert.equal(service.clients.update('northstar', { name: 'Edited' }).ok, true)
  assert.equal(service.clients.getById('northstar')?.name, 'Edited')
  assert.equal(database.getPersistenceResult().status, 'unavailable')
})

test('preparation store refreshes collection-only edits with stable cached snapshots', async () => {
  const { createPreparationStore } = await import('../src/services/preparationStore.ts')
  const { database, service } = setup()
  const store = createPreparationStore(database, service.loadPreparation, 'northstar-meeting')
  assert.equal(store.getSnapshot(), store.getSnapshot())
  let calls = 0; const unsubscribe = store.subscribe(() => { calls++ })
  const before = store.getSnapshot(), domainBefore = database.getState()
  service.clients.update('northstar', { name: 'Northstar updated' })
  assert.equal(database.getState(), domainBefore)
  assert.notEqual(store.getSnapshot(), before)
  const current = store.getSnapshot(); assert.equal(current.status === 'found' && current.value.client.name, 'Northstar updated')
  assert.equal(calls, 1); unsubscribe()
  service.clients.update('northstar', { name: 'Changed while unsubscribed' })
  const stop = store.subscribe(() => {})
  const resubscribed = store.getSnapshot(); assert.equal(resubscribed.status === 'found' && resubscribed.value.client.name, 'Changed while unsubscribed')
  stop()
})

test('meeting filters narrow linked tasks independently of global filters and react to shared edits', () => {
  const { database, service } = setup()
  database.dispatch({ type: 'filters', patch: { query: 'unrelated', status: 'completed', priority: 'urgent', from: '2027-01-01', to: '2027-01-02' } })
  const globalFilters = { ...database.getState().filters }
  const load = () => { const result = service.loadPreparation('northstar-meeting'); assert.ok(result.status === 'found'); return result.value.tasks }
  const all = filterTasks(load(), emptyFilters(), '2026-10-12')
  assert.equal(all.length, 3)
  assert.ok(all.every(t => ['task-3', 'task-4', 'task-5'].includes(t.id)))
  assert.equal(filterTasks(load(), { ...emptyFilters(), query: 'task-4' }, '2026-10-12').length, 1)
  const tasks = createTaskService(database, () => '2026-10-12')
  tasks.update('task-4', { status: 'blocked', priority: 'urgent', due: '2026-10-10' })
  const narrowed = { ...emptyFilters(), status: 'blocked', priority: 'urgent', from: '2026-10-09', to: '2026-10-11', sort: 'priority' as const }
  assert.deepEqual(filterTasks(load(), narrowed, '2026-10-12').map(t => t.id), ['task-4'])
  assert.deepEqual(filterTasks(load(), { ...emptyFilters(), status: 'overdue' }, '2026-10-12').map(t => t.id), ['task-4'])
  tasks.toggle('task-4')
  assert.equal(filterTasks(load(), narrowed, '2026-10-12').length, 0)
  database.dispatch({ type: 'undo' })
  assert.equal(filterTasks(load(), narrowed, '2026-10-12').length, 1)
  tasks.delete('task-4')
  assert.equal(filterTasks(load(), emptyFilters(), '2026-10-12').length, 2)
  database.dispatch({ type: 'undo' })
  assert.equal(filterTasks(load(), emptyFilters(), '2026-10-12').length, 3)
  assert.deepEqual(database.getState().filters, globalFilters)
})
test('legacy meeting filters default on read without rewriting saved data; refinements survive reload', () => {
  const { storage, values } = setup(), layout = createLayoutService(storage, () => true)
  const input = compositionInput(), composition = plan()
  const legacy = { version: 2 as const, kind: 'meeting' as const, meetingId: input.preparation.meeting.id, intent: input.intent, composition, response: serializeMeetingComposition(composition) }
  values.set(layoutStorageKey, JSON.stringify(legacy))
  const raw = values.get(layoutStorageKey)
  const loaded = layout.loadSession()
  assert.ok(loaded.status === 'found' && loaded.value.version === 2 && loaded.value.kind === 'meeting')
  assert.deepEqual(loaded.value.taskFilters, emptyFilters())
  assert.equal(values.get(layoutStorageKey), raw)
  const session = { ...loaded.value, taskFilters: { ...emptyFilters(), query: 'task', status: 'blocked', priority: 'high', sort: 'priority' as const, from: '2026-10-01', to: '2026-10-15' } }
  assert.equal(layout.saveMeeting(session).status, 'saved')
  assert.deepEqual(createLayoutService(storage, () => true).loadSession(), { status: 'found', value: session })
})
test('explicit malformed meeting filters are rejected and their raw storage is preserved', () => {
  const { storage, values } = setup(), layout = createLayoutService(storage, () => true)
  const input = compositionInput(), composition = plan()
  const session = { version: 2, kind: 'meeting', meetingId: input.preparation.meeting.id, intent: input.intent, composition, response: serializeMeetingComposition(composition) }
  for (const taskFilters of [null, {}, { ...emptyFilters(), status: 'unknown' }, { ...emptyFilters(), priority: 'unknown' }, { ...emptyFilters(), from: '2026-02-30' }, { ...emptyFilters(), from: '2026-10-15', to: '2026-10-01' }]) {
    const raw = JSON.stringify({ ...session, taskFilters })
    values.set(layoutStorageKey, raw)
    assert.equal(layout.loadSession().status, 'invalid')
    assert.equal(values.get(layoutStorageKey), raw)
  }
})
test('meeting filter continuity retains only the active matching meeting', () => {
  const input = compositionInput(), composition = plan()
  const next = meetingLayoutSchema.parse({ version: 2, kind: 'meeting', meetingId: input.preparation.meeting.id, intent: input.intent, composition, response: serializeMeetingComposition(composition) })
  const current = { ...next, taskFilters: { ...emptyFilters(), query: 'blocker', status: 'blocked' } }
  const retained = retainMeetingTaskFilters(current, next)
  assert.deepEqual(retained.taskFilters, current.taskFilters)
  assert.notEqual(retained.taskFilters, current.taskFilters)
  assert.deepEqual(retainMeetingTaskFilters({ ...current, meetingId: 'another-meeting' }, next).taskFilters, emptyFilters())
  assert.deepEqual(retainMeetingTaskFilters(null, next).taskFilters, emptyFilters())
})
test('blocked layout storage reports unavailable without affecting meeting filter selection', () => {
  const storage = createBrowserStorage(() => { throw new Error('blocked') }), layout = createLayoutService(storage, () => true)
  const input = compositionInput(), composition = plan()
  const session = meetingLayoutSchema.parse({ version: 2, kind: 'meeting', meetingId: input.preparation.meeting.id, intent: input.intent, composition, response: serializeMeetingComposition(composition), taskFilters: { ...emptyFilters(), query: 'task-3' } })
  assert.equal(layout.saveMeeting(session).status, 'unavailable')
  assert.equal(filterTasks(input.preparation.tasks, session.taskFilters, '2026-10-12').length, 1)
})
