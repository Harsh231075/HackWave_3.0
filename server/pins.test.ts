import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinService, pinCollectionKey } from '../client/src/services/pinService.ts'
import { loadPinnedRecords } from '../client/src/services/pinnedRecords.ts'
import { createBrowserDatabase } from '../client/src/services/browserDatabase.ts'
import { createBrowserStorage } from '../client/src/services/local/browserStorage.ts'
import { createRecordStore } from '../client/src/services/preparationStore.ts'
import { createAdaptiveDataService } from '../client/src/services/adaptiveDataService.ts'
import { createTaskService } from '../client/src/services/taskService.ts'
import { createUsageWorkspaceService } from '../client/src/services/usageWorkspaceService.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES, DEMO_DATE } from './fixtures/demo.ts'
import { emptyFilters, filterTasks } from '../client/src/domain/workspace.ts'
import { activeInstanceId, planWidgetCanvas, widgetSelectionKey, type WidgetBinding, type WidgetInstance, type PinnedWidget } from '../client/src/domain/widgetInstances.ts'
import { widgetTypes, type WidgetType } from '../client/src/lib/workspace/config.ts'
const seed = { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }
const collections = { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES }
function setup() {
  const values = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: k => values.get(k) ?? null, setItem: (k, v) => { values.set(k, v) }, removeItem: k => { values.delete(k) } }))
  const database = createBrowserDatabase(storage, seed, collections)
  let count = 0
  const pins = createPinService(database, () => `id-${++count}`, () => '2026-10-12T00:00:00.000Z')
  return { database, pins, storage, values }
}
function instance(type: WidgetType = 'tasks', binding: WidgetBinding = { kind: 'workspace' }): WidgetInstance {
  return { instanceId: activeInstanceId(type, binding), widgetType: type, span: 'wide', binding, viewState: { taskFilters: emptyFilters(), selectedDate: DEMO_DATE, calendarView: 'month', calendarCategory: 'all' }, explanation: { type, reason: 'Relevant records.', evidence: [] }, fingerprint: '', label: 'Original selection' }
}
function list(service: ReturnType<typeof createPinService>) { const result = service.loadPins(); assert.ok(result.status === 'found'); return result.value }
function add(service: ReturnType<typeof createPinService>, widget: WidgetInstance) { const result = service.pinWidget(widget); assert.ok(result.ok, result.ok ? '' : result.message); return result.value.at(-1)! }
const meeting: WidgetBinding = { kind: 'meeting', meetingId: 'northstar-meeting',  }
const usage: WidgetBinding = { kind: 'usage', intent: { goalType: 'usage_investigation',   dateRange: { from: '2026-10-05', to: '2026-10-11' }, constraints: { segment: 'mobile' } } }

test('pins initialize lazily and preserve stable IDs, order, scope and filters on reload', () => {
  const { database, pins, storage, values } = setup()
  assert.deepEqual(list(pins), []); assert.equal(values.size, 0)
  const first = add(pins, instance('tasks', meeting)), second = add(pins, instance('usage', usage))
  assert.ok(pins.updatePinViewState(first.pinId, { taskFilters: { ...emptyFilters(), query: 'onboarding' } }).ok)
  const restored = createPinService(createBrowserDatabase(storage, seed, collections))
  assert.deepEqual(list(restored).map(p => p.pinId), [first.pinId, second.pinId])
  assert.equal(list(restored)[0].instanceId, first.instanceId)
  assert.deepEqual(list(restored)[0].binding, meeting)
  assert.equal(list(restored)[0].viewState.taskFilters.query, 'onboarding')
  assert.equal(database.getState().history.length, 0)
})
test('duplicate pin is idempotent and a seventh pin never overwrites the six saved views', () => {
  const { pins } = setup()
  const first = add(pins, instance())
  assert.equal(add(pins, instance()).pinId, first.pinId)
  for (const type of ['outline', 'metrics', 'timeline', 'calendar', 'activity'] as WidgetType[]) add(pins, instance(type))
  assert.equal(pins.pinWidget(instance('resources')).ok, false)
  assert.equal(list(pins).length, 6)
  assert.equal(list(pins)[0].pinId, first.pinId)
})
test('pin state edits validate dates and cannot change the immutable binding or identity', () => {
  const { pins } = setup(); const saved = add(pins, instance('tasks', meeting))
  const before = list(pins)
  assert.equal(pins.updatePinViewState(saved.pinId, { taskFilters: { ...emptyFilters(), from: '2026-10-14', to: '2026-10-12' } }).ok, false)
  assert.equal(pins.updatePinViewState(saved.pinId, { binding: { kind: 'workspace' } } as never).ok, false)
  assert.deepEqual(list(pins), before)
  assert.ok(pins.updatePinViewState(saved.pinId, { taskFilters: { ...emptyFilters(), priority: 'urgent' } }).ok)
  assert.equal(list(pins)[0].instanceId, saved.instanceId)
  assert.deepEqual(list(pins)[0].binding, meeting)
})
test('invalid pin collection is preserved until explicit Clear pins; unrelated collections remain', () => {
  const { pins, database, values } = setup()
  database.writeCollection(pinCollectionKey, { version: 99, pins: [] })
  const raw = values.get('orlo-browser-db-v2')
  assert.equal(pins.loadPins().status, 'invalid'); assert.equal(pins.pinWidget(instance()).ok, false)
  assert.equal(values.get('orlo-browser-db-v2'), raw)
  assert.ok(pins.clearPins().ok); assert.deepEqual(list(pins), [])
  assert.equal(database.readCollection('meetings').status, 'found')
})
test('malformed outer database is never overwritten even by Clear pins', () => {
  const { values, storage } = setup(); values.set('orlo-browser-db-v2', '{')
  const pins = createPinService(createBrowserDatabase(storage, seed, collections))
  assert.equal(pins.loadPins().status, 'invalid'); assert.equal(pins.clearPins().ok, false)
  assert.equal(values.get('orlo-browser-db-v2'), '{')
})
test('blocked storage keeps pins and filter edits available in memory without domain undo entries', () => {
  const storage = createBrowserStorage(() => { throw new Error('blocked') })
  const database = createBrowserDatabase(storage, seed, collections)
  const pins = createPinService(database, () => 'memory-pin')
  const result = pins.pinWidget(instance()); assert.ok(result.ok); assert.equal(result.persistence.status, 'unavailable')
  assert.ok(pins.updatePinViewState('memory-pin', { taskFilters: { ...emptyFilters(), query: 'draft' } }).ok)
  assert.equal(list(pins)[0].viewState.taskFilters.query, 'draft'); assert.equal(database.getState().history.length, 0)
})
test('saved meeting views retain their selection and react to task changes, deletion and undo', () => {
  const { pins, database } = setup(); const saved = add(pins, instance('tasks', meeting))
  const preparation = createAdaptiveDataService(database)
  database.dispatch({ type: 'filters', patch: { query: 'unrelated' } })
  let records = preparation.loadPreparation('northstar-meeting'); assert.ok(records.status === 'found')
  assert.equal(filterTasks(records.value.tasks, saved.viewState.taskFilters, DEMO_DATE).length, 3)
  createTaskService(database, () => DEMO_DATE).toggle('task-4')
  const changed = loadPinnedRecords(database, saved); assert.ok(changed.status === 'found'); assert.notEqual(changed.value.fingerprint, saved.fingerprint)
  database.dispatch({ type: 'undo' }); const restored = loadPinnedRecords(database, saved); assert.ok(restored.status === 'found'); assert.equal(restored.value.fingerprint, saved.fingerprint)
  database.dispatch({ type: 'delete-event', id: 'northstar-meeting' }); assert.equal(loadPinnedRecords(database, saved).status, 'missing')
  assert.equal(list(pins).length, 1); database.dispatch({ type: 'undo' }); assert.equal(loadPinnedRecords(database, saved).status, 'found')
  database.writeCollection('meetings', ADAPTIVE_DEMO.meetings.filter(m => m.id !== 'northstar-meeting'))
  assert.equal(loadPinnedRecords(database, saved).status, 'missing')
})
test('usage pins keep their dates and segment; invalid records differ from valid empty data', () => {
  const { pins, database } = setup(); const saved = add(pins, instance('usage', usage))
  const northstar = loadPinnedRecords(database, saved); assert.ok(northstar.status === 'found'); assert.match(northstar.value.label, /mobile/)
  const westbridge = createUsageWorkspaceService(database).load({ goalType: 'usage_investigation',   dateRange: { from: '2026-10-05', to: '2026-10-11' } }); assert.ok(westbridge.status === 'found')
  assert.deepEqual(list(pins)[0].binding, usage)
  database.writeCollection('usageObservations', []); assert.equal(loadPinnedRecords(database, saved).status, 'found')
  database.writeCollection('usageObservations',[{}]); assert.equal(loadPinnedRecords(database, saved).status, 'invalid')
})
test('manual usage pins retain optional all-dates queries and calendar pins retain local view state', () => {
  const { pins } = setup()
  const saved = add(pins, instance('usage', { kind: 'usage-query', query: {   segment: 'mobile' } }))
  assert.equal(saved.binding.kind, 'usage-query'); assert.match(saved.label, /mobile/); assert.match(saved.label, /All dates/)
  const calendar = add(pins, instance('calendar'))
  assert.ok(pins.updatePinViewState(calendar.pinId, { selectedDate: '2026-10-15', calendarView: 'week', calendarCategory: 'break' }).ok)
  assert.equal(list(pins)[1].viewState.selectedDate, '2026-10-15'); assert.equal(list(pins)[1].viewState.calendarCategory, 'break')
})
test('unsupported bindings and missing record selections cannot be pinned', () => {
  const { pins } = setup()
  assert.equal(pins.pinWidget(instance('tasks', { kind: 'google-calendar', accountId: 'test', calendarId: 'primary', mode: 'browse' })).ok, false)
  assert.equal(pins.pinWidget(instance('calendar', meeting)).ok, false)
  assert.equal(pins.pinWidget(instance('usage', { kind: 'usage-query', query: { dateRange: { from: '2026-10-15', to: '2026-10-01' } } })).ok, false)
})
test('external pin store refreshes for collection-only edits without unstable snapshots', () => {
  const { pins, database } = setup(); const store = createRecordStore(database, pins.loadPins)
  const initial = store.getSnapshot(); assert.equal(store.getSnapshot(), initial)
  let notifications = 0; const unsubscribe = store.subscribe(() => notifications++)
  add(pins, instance()); assert.equal(notifications, 1)
  const result = store.getSnapshot(); assert.ok(result.status === 'found'); assert.equal(result.value.length, 1)
  assert.equal(store.getSnapshot(), result); unsubscribe()
})
test('semantic equivalence ignores unrelated task filters but includes task and overdue summary filters', () => {
  for (const type of ['outline', 'resources', 'context'] as WidgetType[]) {
    const view = instance(type, meeting), changed = { ...view, viewState: { ...view.viewState, taskFilters: { ...emptyFilters(), query: 'other' } } }
    assert.equal(widgetSelectionKey(view), widgetSelectionKey(changed))
  }
  const tasks = instance('tasks', meeting); assert.notEqual(widgetSelectionKey(tasks), widgetSelectionKey({ ...tasks, viewState: { ...tasks.viewState, taskFilters: { ...emptyFilters(), query: 'other' } } }))
  const overdue = instance('metrics', { kind: 'overdue', intent: { goalType: 'overdue_review',  dateRange: { from: '0001-01-01', to: '2026-10-11' } }, referenceDate: DEMO_DATE })
  assert.notEqual(widgetSelectionKey(overdue), widgetSelectionKey({ ...overdue, viewState: { ...overdue.viewState, taskFilters: { ...emptyFilters(), status: 'blocked' } } }))
})
test('canvas deduplicates exact selections, preserves different scopes and restores omitted optional widgets', () => {
  const { pins } = setup(); const saved = add(pins, instance('tasks', meeting))
  assert.equal(planWidgetCanvas([instance('tasks', meeting)], [saved], 'meeting').active.length, 0)
  assert.equal(planWidgetCanvas([instance('tasks')], [saved]).active.length, 1)
  const active = widgetTypes.map(type => instance(type))
  const retained = Array.from({ length: 6 }, (_, index) => ({ ...saved, pinId: `pin-${index}`, instanceId: `pin:${index}`, viewState: { ...saved.viewState, taskFilters: { ...emptyFilters(), query: `${index}` } } })) as PinnedWidget[]
  const plan = planWidgetCanvas(active, retained)
  assert.equal(plan.active.length + plan.pins.length, 14); assert.equal(plan.omitted, active.length - plan.active.length)
  for (const required of ['metrics', 'tasks', 'context', 'usage', 'outline']) assert.ok(plan.active.some(w => w.widgetType === required))
  assert.equal(planWidgetCanvas(active, []).active.length, 14)
  const usagePlan = planWidgetCanvas(active.map(w => ({ ...w, binding: usage })), retained, 'usage')
  assert.ok(usagePlan.active.some(w => w.widgetType === 'context')); assert.ok(usagePlan.active.some(w => w.widgetType === 'usage'))
})
test('clear and unpin preserve domain edits and remove only requested saved views', () => {
  const { pins, database } = setup(); const one = add(pins, instance()); const two = add(pins, instance('outline'))
  database.dispatch({ type: 'draft', key: 'meeting-agenda:northstar-meeting', value: 'Saved agenda' })
  assert.ok(pins.unpinWidget(one.pinId).ok); assert.equal(list(pins)[0].pinId, two.pinId)
  assert.ok(pins.clearPins().ok); assert.deepEqual(list(pins), [])
  assert.equal(database.getState().drafts['meeting-agenda:northstar-meeting'], 'Saved agenda')
})

test('manual and resolved usage views deduplicate when their effective queries match', () => {
  assert.ok(usage.kind === 'usage')
  const manual = instance('usage', { kind: 'usage-query', query: {   dateRange: usage.intent.dateRange, segment: usage.intent.constraints?.segment } })
  assert.equal(widgetSelectionKey(manual), widgetSelectionKey(instance('usage', usage)))
  const { pins } = setup(); const first = add(pins, manual)
  assert.equal(add(pins, instance('usage', usage)).pinId, first.pinId)
})
test('filter updates cannot create a duplicate saved selection', () => {
  const { pins } = setup(); const first = add(pins, instance())
  const other = instance(); other.viewState.taskFilters.query = 'other'
  const second = add(pins, other)
  assert.equal(pins.updatePinViewState(second.pinId, { taskFilters: first.viewState.taskFilters }).ok, false)
  assert.equal(list(pins)[1].viewState.taskFilters.query, 'other')
})
