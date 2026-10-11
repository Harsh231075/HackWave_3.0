import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createWorkspaceDocumentService, makeInstance } from '../src/services/workspaceDocumentService.ts'
import { emptyWorkspace, resetWorkspaceLayout, clearWorkspacePins, commitWorkspace, applyInstanceOperations, resolveTarget, TargetError } from '../src/domain/workspaceDocument.ts'
import { applyComponentView } from '../src/domain/instanceViews.ts'
import { fallbackComponentIntent, type ComponentRequest } from '../src/domain/componentIntent.ts'
import { createPinService } from '../src/services/pinService.ts'
import { createWorkspaceActionService } from '../src/services/workspaceActionService.ts'
import { loadActionScope } from '../src/services/actionScope.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES, DEMO_DATE } from './fixtures/demo.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import type { WidgetBinding } from '../src/domain/widgetInstances.ts'
const seed = { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }
const collections = { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES }
function setup(blocked = false) {
  const values = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (blocked) throw new Error('Quota'); values.set(key, value) }, removeItem: key => { values.delete(key) } }))
  const database = createBrowserDatabase(storage, seed, collections)
  return { values, database, storage, service: createWorkspaceDocumentService(database) }
}
const request: ComponentRequest = { goal: '', referenceDate: DEMO_DATE, timezone: 'Asia/Kolkata', catalog: { owners: ['Maya'],   draftKeys: [], topics: [] } }
function view(goal: string) { const result = fallbackComponentIntent({ ...request, goal }); assert.equal(result.action, 'view'); if (result.action !== 'view') throw new Error(goal); return result }
const meeting: WidgetBinding = { kind: 'meeting', meetingId: 'northstar-meeting',  }

test('independent instances preserve scope and filters; ambiguous names require a target', () => {
  const first = makeInstance('tasks', { kind: 'workspace' }, { owner: 'Maya' }, 'first')
  const second = makeInstance('tasks', { kind: 'workspace' }, {}, 'second')
  const document = { ...emptyWorkspace(), active: [first, second] }
  assert.throws(() => resolveTarget(document, 'tasks'), TargetError)
  const next = applyComponentView(document, view('Only high priority tasks'), 'Only high priority tasks', undefined, 'first')
  assert.equal(next.active[0].instanceId, 'first'); assert.equal(next.active[0].viewState.taskFilters.priority, 'high')
  assert.deepEqual(next.active[1], second)
  assert.equal(resolveTarget(next, 'tasks')?.instanceId, 'first')
})
test('scope replacement resets incompatible state and preserves identity', () => {
  const first = makeInstance('tasks', meeting, { owner: 'Maya', taskFilters: { query: 'old', status: 'blocked', priority: 'high', sort: 'due', from: '', to: '' } }, 'first')
  const plan = view('Show all tasks')
  const next = applyComponentView({ ...emptyWorkspace(), active: [first] }, plan, 'Show all tasks')
  assert.deepEqual(next.active[0].binding, { kind: 'workspace' })
  assert.equal(next.active[0].instanceId, 'first'); assert.equal(next.active[0].viewState.owner, undefined)
  assert.equal(next.active[0].viewState.taskFilters.status, 'all')
})
test('mixed calendar and tasks choose only supported Google bindings', () => {
  const binding: WidgetBinding = { kind: 'google-calendar', calendarId: 'primary', accountId: 'account-a', mode: 'browse' }
  const next = applyComponentView(emptyWorkspace(), view('Show calendar and tasks'), 'Show calendar and tasks', binding)
  assert.equal(next.active.find(w => w.widgetType === 'calendar')?.binding.kind, 'google-calendar')
  assert.equal(next.active.find(w => w.widgetType === 'tasks')?.binding.kind, 'workspace')
})
test('another task view gets its own identity; ordinary additions reuse an existing selection', () => {
  const first = applyComponentView(emptyWorkspace(), view('Show tasks'), 'Show tasks')
  const reused = applyComponentView(first, view('Show tasks'), 'Show tasks')
  assert.equal(reused.active.length, 1)
  const another = applyComponentView(reused, view('Show another tasks view'), 'Show another tasks view')
  assert.equal(another.active.length, 2); assert.notEqual(another.active[0].instanceId, another.active[1].instanceId)
})
test('operation batches reject errors and capacity without mutating the input', () => {
  const document = { ...emptyWorkspace(), active: [makeInstance('tasks', undefined, {}, 'first')] }
  const before = structuredClone(document)
  assert.throws(() => applyInstanceOperations(document, [{ type: 'resize', widget: 'tasks', span: 'wide' }, { type: 'move', widget: 'tasks', relativeTo: 'calendar', position: 'before' }], makeInstance))
  assert.deepEqual(document, before)
  const full = { ...emptyWorkspace(), active: Array.from({ length: 14 }, (_, i) => makeInstance('tasks', undefined, {}, String(i))) }
  assert.throws(() => applyInstanceOperations(full, [{ type: 'add', widgets: ['calendar'] }], makeInstance))
  assert.equal(full.active.length, 14)
})
test('pinning and unpinning use the canonical document and retain the instance ID', () => {
  const { database, service } = setup()
  const instance = makeInstance('tasks', meeting, {}, 'first')
  service.save({ ...emptyWorkspace(), active: [instance] })
  const pins = createPinService(database)
  const pinned = pins.pinWidget(instance); assert.ok(pinned.ok)
  let loaded = service.load(); assert.ok(loaded.status === 'found')
  assert.equal(loaded.value.active.length, 0); assert.equal(loaded.value.pins[0].instanceId, 'first')
  const cleared = applyInstanceOperations(loaded.value, [{ type: 'clear' }], makeInstance)
  assert.equal(cleared.pins.length, 1)
  service.save(cleared)
  assert.ok(pins.unpinWidget(pinned.value[0].pinId).ok)
  loaded = service.load(); assert.ok(loaded.status === 'found'); assert.equal(loaded.value.active[0].instanceId, 'first'); assert.equal(loaded.value.pins.length, 0)
})
test('explicit pinned removal invalidates prepared actions and clear can produce an empty canvas', () => {
  const { database, service } = setup()
  const instance = makeInstance('tasks', meeting, {}, 'first')
  service.save({ ...emptyWorkspace(), active: [instance] })
  const result = createPinService(database).pinWidget(instance); assert.ok(result.ok)
  const loaded = service.load(); assert.ok(loaded.status === 'found')
  const task = loadActionScope(database, meeting)!.tasks[0]
  const actions = createWorkspaceActionService(database)
  const prepared = actions.prepare({ type: 'task.edit', taskId: task.id }, { binding: meeting, instanceId: 'first', pinId: result.value[0].pinId, revision: loaded.value.revision, referenceDate: DEMO_DATE })
  assert.ok(prepared.ok && prepared.value.type === 'task.edit')
  service.save(applyInstanceOperations(loaded.value, [{ type: 'remove', widgets: ['first'] }], makeInstance, true))
  assert.equal(actions.saveTask(prepared.value, task).ok, false)
  const next = service.load(); assert.ok(next.status === 'found'); assert.equal(next.value.active.length + next.value.pins.length, 0)
})
test('scope and revision changes reject stale task editors', () => {
  const { database, service } = setup()
  const instance = makeInstance('tasks', meeting, {}, 'first')
  const document = { ...emptyWorkspace(), active: [instance], revision: 2 }
  service.save(document)
  const task = loadActionScope(database, meeting)!.tasks[0], actions = createWorkspaceActionService(database)
  const prepared = actions.prepare({ type: 'task.edit', taskId: task.id }, { binding: meeting, instanceId: 'first', revision: 2, referenceDate: DEMO_DATE })
  assert.ok(prepared.ok && prepared.value.type === 'task.edit')
  service.save(commitWorkspace(document, { active: [{ ...instance, binding: { kind: 'workspace' } }] }))
  assert.equal(actions.saveTask(prepared.value, task).ok, false)
})
test('old main layouts and managed history are not restored into the new document', () => {
  const { service, storage, values } = setup()
  storage.writeJson('gogpt-app-layout-v1', { version: 1, response: 'WorkspaceWidget("tasks", "wide")' })
  storage.writeJson('orlo-continuous-workspace-v1', [{ id: 'tasks', span: 'wide' }])
  storage.writeJson('orlo-workspace-conversation-v1', { turns: [{ id: 'old', prompt: 'tasks', reply: 'Ready', status: 'pending' }] })
  const original = values.get('gogpt-app-layout-v1')
  const initial = service.initialize()
  assert.equal(initial.document.version, 3)
  assert.deepEqual(initial.document.active.map(w => w.widgetType), ['metrics', 'chart', 'timeline', 'activity'])
  assert.deepEqual(initial.document.turns, [])
  assert.equal(values.get('gogpt-app-layout-v1'), original) // The bootstrap gate owns old-key cleanup.
  assert.deepEqual(service.initialize().document, initial.document)
})
test('invalid canonical data is preserved and blocked storage retains in-memory edits', () => {
  const { service, database } = setup()
  database.writeCollection('workspaceDocument', { version: 999 })
  assert.equal(service.initialize().persistence.status, 'invalid')
  assert.deepEqual(database.readCollection('workspaceDocument'), { status: 'found', value: { version: 999 } })
  const blocked = setup(true)
  assert.equal(blocked.service.initialize().persistence.status, 'unavailable')
  const document = { ...emptyWorkspace(), active: [makeInstance('tasks')] }
  assert.equal(blocked.service.save(document).status, 'unavailable')
  const restored = blocked.service.load(); assert.ok(restored.status === 'found'); assert.equal(restored.value.active[0].instanceId, document.active[0].instanceId)
})
test('undo restores layout state but keeps text history and survives reload', () => {
  const { service, storage } = setup()
  const first = { ...emptyWorkspace(), active: [makeInstance('tasks', undefined, {}, 'first')] }
  const next = commitWorkspace(first, { active: [{ ...first.active[0], span: 'narrow' }], turns: [{ id: 'turn', prompt: 'resize', reply: 'Done', status: 'ready' }] })
  service.save(commitWorkspace(next, { active: first.active, pins: first.pins, targets: first.targets }))
  const reloaded = createWorkspaceDocumentService(createBrowserDatabase(storage, seed, collections)).initialize().document
  assert.equal(reloaded.active[0].span, 'full'); assert.equal(reloaded.turns.length, 1); assert.equal(reloaded.active[0].instanceId, 'first')
})
test('Google notes remain account-qualified and unrelated local drafts are not in scope', () => {
  const { database } = setup()
  const binding: WidgetBinding = { kind: 'google-calendar', accountId: 'account-a', calendarId: 'primary', eventId: 'event', mode: 'prepare' }
  assert.equal(loadActionScope(database, binding)?.draft?.key, 'google-preparation:account-a:primary:event')
  assert.equal(loadActionScope(database, { ...binding, accountId: 'account-b' })?.draft?.key, 'google-preparation:account-b:primary:event')
  assert.equal(loadActionScope(database, binding)?.tasks.length, 0)
})

test('a chosen target in a combined view does not change another widget type into it', () => {
  const first = makeInstance('tasks', undefined, {}, 'first')
  const second = makeInstance('tasks', { kind: 'workspace' }, {}, 'second')
  const next = applyComponentView({ ...emptyWorkspace(), active: [first, second] }, view('Show calendar and tasks'), 'Show calendar and tasks', undefined, 'first')
  assert.equal(next.active.find(w => w.instanceId === 'first')?.widgetType, 'tasks')
  assert.equal(next.active.find(w => w.instanceId === 'second')?.widgetType, 'tasks')
  assert.equal(next.active.filter(w => w.widgetType === 'calendar').length, 1)
})
test('older canonical document versions are rejected without replacement', () => {
  const { service, database } = setup()
  for (const version of [1, 2]) {
    database.writeCollection('workspaceDocument', { ...emptyWorkspace(), version })
    assert.equal(service.initialize().persistence.status, 'invalid')
    const stored = database.readCollection('workspaceDocument')
    assert.ok(stored.status === 'found')
    assert.equal((stored.value as { version: number }).version, version)
  }
})
test('shared task actions accept existing records and reject missing IDs', () => {
  const { database } = setup()
  const actions = createWorkspaceActionService(database)
  const binding: WidgetBinding = { kind: 'workspace' }
  const scope = loadActionScope(database, binding)!
  assert.equal(scope.tasks.length, database.getState().tasks.length)
  const origin = { binding, referenceDate: DEMO_DATE, revision: 0 }
  assert.ok(actions.prepare({ type: 'task.edit', taskId: scope.tasks[0].id }, origin).ok)
  assert.equal(actions.prepare({ type: 'task.edit', taskId: 'missing' }, origin).ok, false)
})

test('header reset preserves pins and history without duplicating default pinned views', () => {
  const pinned = { ...makeInstance('metrics'), pinId: 'pinned-metrics', createdAt: new Date().toISOString() }
  const document = commitWorkspace(emptyWorkspace(), { active: [makeInstance('tasks')], pins: [pinned], targets: ['old-target'], turns: [{ id: 'turn', prompt: 'Show tasks', reply: 'Ready', status: 'ready' }] })
  const reset = resetWorkspaceLayout(document)
  assert.deepEqual(reset.pins, document.pins)
  assert.deepEqual(reset.turns, document.turns)
  assert.deepEqual(reset.targets, [])
  assert.deepEqual(reset.active.map(widget => widget.widgetType), ['chart', 'timeline', 'activity'])
  assert.equal(reset.revision, document.revision + 1)
})
test('header clear pins preserves active views and history and removes pinned targets', () => {
  const active = makeInstance('tasks')
  const pinned = { ...makeInstance('calendar'), pinId: 'calendar-pin', createdAt: new Date().toISOString() }
  const document = commitWorkspace(emptyWorkspace(), { active: [active], pins: [pinned], targets: [active.instanceId, pinned.instanceId], turns: [{ id: 'turn', prompt: 'Show calendar', reply: 'Ready', status: 'ready' }] })
  const cleared = clearWorkspacePins(document)
  assert.deepEqual(cleared.active, document.active)
  assert.deepEqual(cleared.turns, document.turns)
  assert.deepEqual(cleared.pins, [])
  assert.deepEqual(cleared.targets, [active.instanceId])
  assert.equal(cleared.revision, document.revision + 1)
})

test('route remount initialization does not write or notify an unchanged saved workspace',()=>{
 const {service,database,values}=setup();service.initialize();let notifications=0;database.subscribe(()=>notifications++)
 const before=values.get('orlo-browser-db-v2'),revision=database.getRevision()
 for(let i=0;i<10;i++)createWorkspaceDocumentService(database).initialize()
 assert.equal(notifications,0);assert.equal(database.getRevision(),revision);assert.equal(values.get('orlo-browser-db-v2'),before)
})
test('a new route reader preserves live pending turns while fresh application loads recover interrupted requests',()=>{
 const {service,database,storage}=setup();const initial=service.initialize().document
 service.save({...initial,turns:[{id:'running',prompt:'Show tasks',reply:'Preparing',status:'pending'}]})
 assert.equal(createWorkspaceDocumentService(database).initialize().document.turns[0].status,'pending')
 const fresh=createBrowserDatabase(storage,seed,collections),recovered=createWorkspaceDocumentService(fresh).initialize()
 assert.equal(recovered.document.turns[0].status,'cancelled')
 assert.equal(createWorkspaceDocumentService(fresh).initialize().document.turns[0].status,'cancelled')
})
