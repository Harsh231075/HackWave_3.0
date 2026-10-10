import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyFilters, eventError, filterTasks, workspaceReducer } from '../src/domain/workspace.ts'
import type { Event, Task, WorkspaceState } from '../src/domain/types.ts'

const task: Task = { id: 'task-a', title: 'Prepare a brief', description: '', owner: 'Maya', due: '2026-10-12', duration: 30, priority: 'high', status: 'pending' }
const event: Event = { id: 'session-a', title: 'Review', date: '2026-10-12', start: '10:00', end: '11:00', category: 'meeting', participants: [], agenda: '' }

test('all projects share tasks, filters, drafts, pins, and undo', () => {
  let state: WorkspaceState = { tasks: [task, { ...task, id: 'task-b', owner: 'Alex' }], events: [], drafts: {}, dismissed: [], activity: [], filters: emptyFilters(), pins: [], history: [] }
  assert.equal(filterTasks(state.tasks, state.filters, '2026-10-12').length, 2)
  state = workspaceReducer(state, { type: 'filters', patch: { query: 'Alex' } })
  assert.deepEqual(filterTasks(state.tasks, state.filters, '2026-10-12').map(task => task.id), ['task-b'])
  state = workspaceReducer(state, { type: 'pin', id: 'tasks' })
  assert.deepEqual(state.pins, ['tasks'])
  state = workspaceReducer(state, { type: 'draft', key: 'outline', value: 'Shared preparation' })
  state = workspaceReducer(state, { type: 'toggle', id: 'task-a' })
  assert.equal(state.tasks[0].status, 'completed')
  state = workspaceReducer(state, { type: 'undo' })
  assert.equal(state.tasks[0].status, 'pending')
  assert.equal(state.drafts.outline, 'Shared preparation')
})

test('scheduling checks conflicts in the shared calendar', () => {
  assert.match(eventError({ ...event, id: 'session-b', start: '10:30', end: '11:30' }, [event]) ?? '', /overlaps/)
  assert.equal(eventError({ ...event, id: 'session-b', start: '11:00', end: '12:00' }, [event]), null)
})

test('deleting an event is undoable and missing events leave history intact', () => {
  const initial: WorkspaceState = { tasks: [], events: [event], drafts: {}, dismissed: [], activity: [], filters: emptyFilters(), pins: [], history: [] }
  assert.equal(workspaceReducer(initial, { type: 'delete-event', id: 'missing' }), initial)
  const removed = workspaceReducer(initial, { type: 'delete-event', id: event.id })
  assert.equal(removed.events.length, 0)
  assert.equal(removed.history.length, 1)
  assert.deepEqual(workspaceReducer(removed, { type: 'undo' }).events, [event])
})

test('rescheduling keeps one event and rejects conflicts without changing history', () => {
  const initial: WorkspaceState = { tasks: [], events: [event, { ...event, id: 'other', start: '12:00', end: '13:00' }], drafts: {}, dismissed: [], activity: [], filters: emptyFilters(), pins: [], history: [] }
  assert.equal(workspaceReducer(initial, { type: 'event', event: { ...event, start: '12:30', end: '13:30' } }), initial)
  const moved = workspaceReducer(initial, { type: 'event', event: { ...event, start: '14:00', end: '15:00' } })
  assert.equal(moved.events.length, 2)
  assert.equal(moved.events.find(item => item.id === event.id)?.start, '14:00')
  assert.deepEqual(workspaceReducer(moved, { type: 'undo' }).events, initial.events)
})
