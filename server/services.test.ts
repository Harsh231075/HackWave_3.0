import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../client/src/services/local/browserStorage.ts'
import { createWorkspaceService, workspaceStorageKey } from '../client/src/services/workspaceService.ts'
import { createPreferencesService } from '../client/src/services/preferencesService.ts'
import { createGenerationService } from '../client/src/services/generationService.ts'
import { createResourceService } from '../client/src/services/resourceService.ts'
import { ServiceError } from '../client/src/services/serviceErrors.ts'
import { prepareTask, prepareEvent, prepareFocusTime } from '../client/src/domain/commands.ts'
import { emptyFilters, workspaceReducer } from '../client/src/domain/workspace.ts'
import type { WorkspaceState } from '../client/src/domain/types.ts'
const initial = (): WorkspaceState => ({ tasks: [], events: [], drafts: {}, dismissed: [], activity: [], filters: emptyFilters(), history: [] })
function memory() {
  const data = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) } }))
  return { data, storage }
}
test('workspace validates records, preserves malformed input, strips ephemeral state, and handles storage errors', () => {
  const { storage, data } = memory()
  const service = createWorkspaceService(storage)
  assert.equal(service.load().status, 'missing')
  data.set(workspaceStorageKey, '{')
  assert.equal(service.load().status, 'invalid')
  assert.equal(data.get(workspaceStorageKey), '{')
  data.set(workspaceStorageKey, '{}')
  assert.equal(service.load().status, 'invalid')
  assert.equal(service.save(initial()).status, 'saved')
  const loaded = service.load()
  assert.equal(loaded.status, 'found')
  assert.equal('filters' in JSON.parse(data.get(workspaceStorageKey)!), false)
  assert.equal(service.save({ ...initial(), tasks: [{}] } as unknown as WorkspaceState).status, 'invalid')
  assert.equal(service.load().status, 'found')
  const broken = createWorkspaceService(createBrowserStorage(() => { throw new Error('blocked') }))
  assert.equal(broken.load().status, 'unavailable')
  assert.equal(broken.save(initial()).status, 'unavailable')
})
test('preferences use legacy keys, independent defaults, partial writes, and tolerate storage failures', () => {
  const { storage, data } = memory()
  data.set('task-view', 'kanban'); data.set('calendar-view', 'wrong')
  const service = createPreferencesService(storage)
  assert.deepEqual(service.load(), { taskView: 'kanban', calendarView: 'month', calendarCategory: 'all' })
  assert.equal(service.save({ calendarView: 'week' }).status, 'saved')
  assert.equal(data.get('task-view'), 'kanban')
  assert.equal(data.get('calendar-view'), 'week')
  assert.equal(service.save({ taskView: 'wrong' } as never).status, 'invalid')
  const broken = createPreferencesService(createBrowserStorage(() => { throw new Error('blocked') }))
  assert.equal(broken.load().taskView, 'list')
  assert.equal(broken.save({ taskView: 'kanban' }).status, 'unavailable')
})
test('resource lookups filter by context and protect seed records', () => {
  const seed = [{ id: 'r', title: 'Resource', kind: 'doc', context: 'project', body: 'Text' }]
  const service = createResourceService(seed)
  service.list()[0].title = 'Changed'
  assert.equal(service.getById('r')?.title, 'Resource')
  assert.deepEqual(service.list('other'), [])
  assert.equal(service.getById('missing'), null)
})
test('task and event commands preserve IDs, reject missing/invalid records, and retain conflicts and undo', () => {
  let state = initial()
  const task = prepareTask({ title: ' Work ', description: '', owner: ' Maya ', due: '2026-10-12', duration: 30, priority: 'medium', status: 'pending' }, state, () => 'task')
  assert.equal(task.ok, true)
  if (!task.ok) return
  state = workspaceReducer(state, task.value.action)
  assert.equal(state.tasks[0].title, 'Work')
  const edit = prepareTask({ ...state.tasks[0], title: 'Edited' }, state, () => 'other')
  assert.equal(edit.ok, true)
  if (edit.ok) assert.equal(edit.value.record.id, 'task')
  assert.equal(prepareTask({ ...state.tasks[0], id: 'missing' }, state).ok, false)
  assert.equal(prepareTask({ ...state.tasks[0], duration: 1 }, state).ok, false)
  const event = prepareEvent({ title: 'Meeting', date: '2026-10-12', start: '10:00', end: '11:00', category: 'meeting', participants: [' Maya '], agenda: '' }, state, () => 'event')
  assert.equal(event.ok, true)
  if (!event.ok) return
  state = workspaceReducer(state, event.value.action)
  assert.equal(prepareEvent({ ...event.value.record, id: undefined }, state).ok, false)
  assert.equal(prepareEvent({ ...event.value.record, id: 'missing' }, state).ok, false)
  state = workspaceReducer(state, { type: 'delete-event', id: 'event' })
  state = workspaceReducer(state, { type: 'undo' })
  assert.equal(state.events[0].id, 'event')
  assert.equal(state.events[0].participants[0], 'Maya')
})
const input = { goal: 'plan', previousUI: 'old', context: { demoDate: '2026-10-12', tasks: [], events: [], drafts: { outline: 'draft' }, pins: ['tasks'], componentState: { view: 'list' } } }
test('generation preserves endpoint, payload, headers, and abort signal', async () => {
  const controller = new AbortController()
  const service = createGenerationService((async (url, options) => {
    assert.equal(url, '/api/generate'); assert.equal(options?.method, 'POST')
    assert.deepEqual(options?.headers, { 'Content-Type': 'application/json' })
    assert.deepEqual(JSON.parse(options?.body as string), input)
    assert.equal(options?.signal, controller.signal)
    return Response.json({ response: 'layout' })
  }) as typeof fetch)
  assert.deepEqual(await service.generate(input, { signal: controller.signal }), { response: 'layout' })
})
test('generation distinguishes HTTP, response, network, and cancellation errors', async () => {
  for (const [response, code, message] of [
    [Response.json({ error: { message: 'Server message' } }, { status: 500 }), 'http', 'Server message'],
    [new Response('bad'), 'response', undefined],
    [Response.json({ response: 2 }), 'response', undefined],
  ] as const) {
    const service = createGenerationService((async () => response) as typeof fetch)
    await assert.rejects(service.generate(input), error => error instanceof ServiceError && error.code === code && (!message || error.message === message))
  }
  const failed = createGenerationService((async () => { throw new Error('offline') }) as typeof fetch)
  await assert.rejects(failed.generate(input), error => error instanceof ServiceError && error.code === 'network')
  const abort = new DOMException('Cancelled', 'AbortError')
  const cancelled = createGenerationService((async () => { throw abort }) as typeof fetch)
  await assert.rejects(cancelled.generate(input), error => error === abort)
})

test('focus recommendations retain their stable ID and respect blockers and conflicts', () => {
  const state = initial()
  state.tasks.push({ id: 'task', title: 'Work', description: '', owner: 'Maya', due: '2026-10-12', duration: 30, priority: 'medium', status: 'pending' })
  const result = prepareFocusTime('task', '2026-10-12', state)
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.record.id, 'recommendation-task')
    const scheduled = workspaceReducer(state, result.value.action)
    scheduled.events[0] = { ...scheduled.events[0], id: 'other-event' }
    assert.equal(prepareFocusTime('task', '2026-10-12', scheduled).ok, false)
  }
  assert.equal(prepareFocusTime('missing', '2026-10-12', state).ok, false)
  state.tasks[0].status = 'blocked'
  assert.equal(prepareFocusTime('task', '2026-10-12', state).ok, false)
})

test('the current store rejects removed task fields without changing stored data', () => {
  const { storage, data } = memory()
  const service = createWorkspaceService(storage)
  const snapshot = { ...initial(), tasks: [{ id: 'legacy', title: 'Keep task', description: '', context: 'Old project', owner: 'Maya', due: '2026-10-12', duration: 30, priority: 'medium', status: 'pending' }] }
  const raw = JSON.stringify(snapshot)
  data.set(workspaceStorageKey, raw)
  assert.equal(service.load().status, 'invalid')
  assert.equal(data.get(workspaceStorageKey), raw)
})
