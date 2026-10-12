import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDatabase } from '../client/src/services/browserDatabase.ts'
import { createBrowserStorage } from '../client/src/services/local/browserStorage.ts'
import { createWorkspaceActionService } from '../client/src/services/workspaceActionService.ts'
import { createFocusSchedulingService } from '../client/src/services/focusSchedulingService.ts'
import { createTaskService } from '../client/src/services/taskService.ts'
import { loadActionScope } from '../client/src/services/actionScope.ts'
import { createPinService } from '../client/src/services/pinService.ts'
import { workspaceActionSchema, type ActionOrigin } from '../client/src/domain/workspaceActions.ts'
import { activeInstanceId } from '../client/src/domain/widgetInstances.ts'
import { emptyFilters } from '../client/src/domain/workspace.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES, DEMO_DATE } from './fixtures/demo.ts'
import { applicationActionEvent, generatedActionsValid } from '../client/src/lib/workspace/actionValidation.ts'
import { createLibrary, defineComponent } from '@openuidev/lang-core'
import { z } from 'zod'
const meeting: ActionOrigin = { binding: { kind: 'meeting', meetingId: 'northstar-meeting',  }, referenceDate: DEMO_DATE, revision: 1 }
function setup() {
  const values = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v) }, removeItem: k => { values.delete(k) } }))
  const database = createBrowserDatabase(storage, { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }, { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES })
  return { database, service: createWorkspaceActionService(database), tasks: createTaskService(database, () => DEMO_DATE), focus: createFocusSchedulingService(database, () => DEMO_DATE), storage }
}
test('action contracts reject scope overrides, arbitrary handlers, invalid dates and empty goals', () => {
  for (const action of [{ type: 'delete' }, { type: 'task.edit', taskId: 'x', binding: meeting.binding }, { type: 'draft.edit', key: 'outline' }, { type: 'focus.schedule', taskId: 'x', date: '2026-02-30' }, { type: 'goal.change', goal: '  ' }]) assert.equal(workspaceActionSchema.safeParse(action).success, false)
  assert.equal(applicationActionEvent({ type: 'continue_conversation', humanFriendlyMessage: 'task.edit' }), null)
  assert.equal(applicationActionEvent({ type: 'workspace_action', params: { action: { type: 'goal.change', goal: 'Review work' }, taskId: 'x' } }), null)
  assert.deepEqual(applicationActionEvent({ type: 'workspace_action', params: { action: { type: 'draft.edit' } } }), { type: 'draft.edit' })
})
test('meeting actions use base membership despite hidden tasks and reject unrelated tasks', () => {
  const { database, service } = setup()
  const scoped = loadActionScope(database, meeting.binding)!
  database.dispatch({ type: 'filters', patch: { query: 'hide everything', status: 'completed' } })
  assert.ok(service.prepare({ type: 'task.edit', taskId: scoped.tasks[0].id }, meeting).ok)
  const unrelated = database.getState().tasks.find(t => !scoped.tasks.some(s => s.id === t.id))!
  assert.equal(service.prepare({ type: 'task.edit', taskId: unrelated.id }, meeting).ok, false)
})
test('task editor rejects changed, deleted or reassigned records without overwriting', () => {
  for (const mode of ['change', 'delete', 'reassign']) {
    const { database, service, tasks } = setup()
    const task = loadActionScope(database, meeting.binding)!.tasks[0]
    const prepared = service.prepare({ type: 'task.edit', taskId: task.id }, meeting)
    assert.ok(prepared.ok && prepared.value.type === 'task.edit')
    if (mode === 'change') tasks.update(task.id, { title: 'External change' })
    if (mode === 'delete') tasks.delete(task.id)
    if (mode === 'reassign') { const links = database.readCollection('relationships'); assert.ok(links.status === 'found'); database.writeCollection('relationships', (links.value as Array<{ targetId: string }>).filter(l => l.targetId !== task.id)) }
    assert.equal(service.saveTask(prepared.value, { ...task, title: 'My edit' }).ok, false)
    assert.notEqual(tasks.getById(task.id)?.title, 'My edit')
  }
})
test('valid task action saves through shared mutations, undo and persistence', () => {
  const { database, service, storage } = setup()
  const task = loadActionScope(database, meeting.binding)!.tasks[0]
  const prepared = service.prepare({ type: 'task.edit', taskId: task.id }, meeting)
  assert.ok(prepared.ok && prepared.value.type === 'task.edit')
  assert.ok(service.saveTask(prepared.value, { ...task, title: 'Reviewed task' }).ok)
  assert.equal(database.getState().tasks.find(t => t.id === task.id)?.title, 'Reviewed task')
  assert.equal(storage.readJson('orlo-data-v2').status, 'found')
  database.dispatch({ type: 'undo' })
  assert.equal(database.getState().tasks.find(t => t.id === task.id)?.title, task.title)
})
test('draft keys derive from original binding, reject conflicts and unsupported draft scopes', () => {
  const { database, service } = setup()
  const prepared = service.prepare({ type: 'draft.edit' }, meeting)
  assert.ok(prepared.ok && prepared.value.type === 'draft.edit')
  assert.equal(prepared.value.key, 'meeting-agenda:northstar-meeting')
  assert.ok(service.saveDraft(prepared.value, 'Saved agenda').ok)
  assert.ok(service.saveDraft(prepared.value, 'Second save').ok)
  database.dispatch({ type: 'draft', key: prepared.value.key, value: 'External edit' })
  assert.equal(service.saveDraft(prepared.value, 'Overwrite').ok, false)
  assert.equal(database.getState().drafts[prepared.value.key], 'External edit')
  const overdue = { ...meeting, binding: { kind: 'overdue' as const, intent: { goalType: 'overdue_review' as const,   dateRange: { from: '0001-01-01', to: '2026-10-11' } }, referenceDate: DEMO_DATE } }
  assert.equal(service.prepare({ type: 'draft.edit' }, overdue).ok, false)
})
test('original pin binding survives another goal and unpin invalidates open actions', () => {
  const { database, service } = setup(), pins = createPinService(database, () => 'pin-1')
  const result = pins.pinWidget({ instanceId: activeInstanceId('tasks', meeting.binding), widgetType: 'tasks', span: 'full', binding: meeting.binding, viewState: { taskFilters: emptyFilters() }, explanation: { type: 'tasks', reason: 'Linked tasks', evidence: [] }, fingerprint: '', label: 'Northstar' })
  assert.ok(result.ok)
  const origin = { ...meeting, pinId: result.value[0].pinId }
  const task = loadActionScope(database, meeting.binding)!.tasks[0]
  const prepared = service.prepare({ type: 'task.edit', taskId: task.id }, origin)
  assert.ok(prepared.ok && prepared.value.type === 'task.edit')
  assert.ok(service.saveTask(prepared.value, { ...task, title: 'From original pin' }).ok)
  pins.unpinWidget(origin.pinId)
  assert.equal(service.prepare({ type: 'draft.edit' }, origin).ok, false)
})
test('focus scheduling works for meeting and workspace scopes; repeated matching confirmation is idempotent', () => {
  const { database, focus } = setup()
  const task = loadActionScope(database, meeting.binding)!.tasks.find(t => t.status === 'pending')!
  const input = { taskId: task.id, date: DEMO_DATE, binding: meeting.binding }
  const slots = focus.findSlots(input); assert.ok(slots.ok && slots.value.length)
  const request = { ...input, start: slots.value[0].start, expectedDuration: task.duration }
  const first = focus.schedule(request); assert.ok(first.ok)
  assert.deepEqual(focus.schedule(request), first)
  assert.equal(focus.schedule({ ...request, start: '17:00' }).ok, false)
  assert.equal(database.getState().events.filter(e => e.id === first.value.id).length, 1)
  assert.ok(focus.findSlots({ ...input, binding: { kind: 'workspace' } }).ok)
})
test('scheduling rejects blockers, changed durations and newly occupied slots', () => {
  const { focus, database, tasks } = setup()
  const task = loadActionScope(database, meeting.binding)!.tasks.find(t => t.status === 'pending')!
  const input = { taskId: task.id, date: DEMO_DATE, binding: meeting.binding }
  const slots = focus.findSlots(input); assert.ok(slots.ok && slots.value.length)
  const slot = slots.value[0], request = { ...input, start: slot.start, expectedDuration: task.duration }
  database.dispatch({ type: 'event', event: { id: 'new-busy', title: 'Busy', ...slot, category: 'meeting', participants: [], agenda: '' } })
  assert.equal(focus.schedule(request).ok, false)
  tasks.update(task.id, { duration: task.duration + 5 })
  assert.equal(focus.schedule(request).ok, false)
  tasks.update(task.id, { status: 'blocked' })
  assert.equal(focus.findSlots(input).ok, false)
})
test('general generated action validation permits local state and rejects external actions and bad task IDs', () => {
  const Action = defineComponent({ description: 'Test component', name: 'WorkspaceAction', props: z.object({ label: z.string(), action: workspaceActionSchema }), component: () => null })
  const Button = defineComponent({ description: 'Test component', name: 'Button', props: z.object({ label: z.string(), action: z.any().optional() }), component: () => null })
  const Card = defineComponent({ description: 'Test component', name: 'Card', props: z.object({ children: z.array(z.union([Action.ref, Button.ref])) }), component: () => null })
  const library = createLibrary({ root: 'Card', components: [Card, Action, Button] })
  const valid = (text: string) => generatedActionsValid(text, library.toJSONSchema(), library.root, INITIAL_TASKS)
  assert.ok(valid('root = Card([WorkspaceAction("Notes", {type: "draft.edit"})])'))
  assert.equal(valid('root = Card([WorkspaceAction("Edit", {type: "task.edit", taskId: "missing"})])'), false)
  assert.equal(valid('root = Card([Button("Go", Action([@OpenUrl("https://example.com")]))])'), false)
  assert.equal(valid('root = Card([Button("Go", Action([@ToAssistant("hello")]))])'), false)
  assert.ok(valid('$count = 1\nroot = Card([Button("Clear", Action([@Reset($count)]))])'))
})

test('optional actions preserve old serialization and reject invalid scoped composition references', async () => {
  const { validateMeetingComposition, serializeMeetingComposition } = await import('../client/src/domain/adaptiveData.ts')
  const { validateUsageComposition, serializeUsageComposition } = await import('../client/src/domain/usageComposition.ts')
  const { validateOverdueComposition, serializeOverdueComposition } = await import('../client/src/domain/overdueReview.ts')
  const { createAdaptiveDataService } = await import('../client/src/services/adaptiveDataService.ts')
  const { createUsageWorkspaceService } = await import('../client/src/services/usageWorkspaceService.ts')
  const { createOverdueReviewService } = await import('../client/src/services/overdueReviewService.ts')
  const { database } = setup()
  const preparation = createAdaptiveDataService(database).loadPreparation('northstar-meeting'); assert.ok(preparation.status === 'found')
  const meetingIntent = { goalType: 'meeting_preparation' as const, meetingId: 'northstar-meeting',   dateRange: { from: '2026-10-13', to: '2026-10-13' } }
  const input = { version: 2 as const, requestId: 'r', intent: meetingIntent, preparation: preparation.value, agenda: '' }
  const plan = { version: 2 as const, requestId: 'r', widgets: (['context','outline'] as const).map(type => ({ type, span: 'full' as const, reason: 'Meeting records', evidence: [{ kind: 'meeting' as const, id: 'northstar-meeting' }] })) }
  const legacy = 'root = Card([Workspace([WorkspaceWidget("context", "full"), WorkspaceWidget("outline", "full")])])'
  assert.equal(serializeMeetingComposition(plan), legacy)
  assert.equal(serializeMeetingComposition({ ...plan, actions: [] }), legacy)
  const withActions = { ...plan, actions: [{ label: 'Agenda', action: { type: 'draft.edit' as const } }] }
  assert.ok(validateMeetingComposition(withActions, input).success)
  assert.match(serializeMeetingComposition(withActions), /WorkspaceAction\("Agenda"/)
  assert.equal(validateMeetingComposition({ ...plan, actions: [{ label: 'Other', action: { type: 'task.edit', taskId: 'task-6' } }] }, input).success, false)
  assert.equal(validateMeetingComposition({ ...plan, actions: Array(5).fill(withActions.actions[0]) }, input).success, false)
  const usageIntent = { goalType: 'usage_investigation' as const,   dateRange: { from: '2026-10-05', to: '2026-10-11' } }
  const usage = createUsageWorkspaceService(database).load(usageIntent); assert.ok(usage.status === 'found')
  const usagePlan = { ...plan, widgets: (['context','usage'] as const).map(type => ({ type, span: 'full' as const, reason: 'Usage records', evidence: [{ kind: 'observation' as const, id: 'usage-2026-10-05-mobile' }] })) }
  assert.equal(serializeUsageComposition(usagePlan), 'root = Card([Workspace([WorkspaceWidget("context", "full"), WorkspaceWidget("usage", "full")])])')
  assert.ok(validateUsageComposition({ ...usagePlan, actions: withActions.actions }, { version: 2, kind: 'usage', requestId: 'r', intent: usageIntent, snapshot: usage.value.snapshot, draft: '' }).success)
  const intent = { goalType: 'overdue_review' as const,   dateRange: { from: '0001-01-01', to: '2026-10-11' } }
  const review = createOverdueReviewService(database).load(intent, DEMO_DATE); assert.ok(review.status === 'found')
  const overduePlan = { ...plan, widgets: (['context','tasks'] as const).map(type => ({ type, span: 'full' as const, reason: 'Review records', evidence: [{ kind: 'task' as const, id: 'task-3' }] })) }
  assert.equal(serializeOverdueComposition(overduePlan), 'root = Card([Workspace([WorkspaceWidget("context", "full"), WorkspaceWidget("tasks", "full")])])')
  assert.equal(validateOverdueComposition({ ...overduePlan, actions: withActions.actions }, { version: 2, kind: 'overdue', requestId: 'r', intent, review: review.value }).success, false)
})
test('usage actions use linked client/project work; manual usage cannot choose arbitrary drafts', () => {
  const { service, database } = setup()
  const origin: ActionOrigin = { ...meeting, binding: { kind: 'usage', intent: { goalType: 'usage_investigation',   dateRange: { from: '2026-10-05', to: '2026-10-11' } } } }
  const task = loadActionScope(database, origin.binding)!.tasks[0]
  assert.ok(service.prepare({ type: 'task.edit', taskId: task.id }, origin).ok)
  const draft = service.prepare({ type: 'draft.edit' }, origin)
  assert.ok(draft.ok && draft.value.type === 'draft.edit'); assert.equal(draft.value.key, 'usage-investigation:'+JSON.stringify(['2026-10-05','2026-10-11','all']))
  const manual: ActionOrigin = { ...meeting, binding: { kind: 'usage-query', query: {  } } }
  assert.equal(service.prepare({ type: 'draft.edit' }, manual).ok, false)
  assert.ok(service.prepare({ type: 'task.edit', taskId: task.id }, manual).ok)
  assert.ok(service.prepare({ type: 'goal.change', goal: 'Prepare a meeting' }, manual).ok)
})
