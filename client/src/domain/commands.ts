import { intentDateSchema } from './intent.ts'
import { eventError, type Action } from './workspace.ts'
import type { Event, Task, WorkspaceState } from './types.ts'
export type TaskInput = Omit<Task, 'id'> & { id?: string }
export type EventInput = Omit<Event, 'id'> & { id?: string }
export type ActionResult<T> = { ok: true; value: T; message?: never } | { ok: false; message: string; value?: never }
export type PreparedAction<T> = ActionResult<{ action: Action; record: T }>
export function prepareTask(input: TaskInput, state: WorkspaceState, createId: () => string = () => crypto.randomUUID()): PreparedAction<Task> {
  if (input.id && !state.tasks.some(task => task.id === input.id)) return { ok: false, message: 'This task is no longer available.' }
  if (!input.title.trim() || !input.owner.trim() || !intentDateSchema.safeParse(input.due).success || !Number.isInteger(input.duration) || input.duration < 5 || input.duration > 480) return { ok: false, message: 'Add a title, owner, due date, and duration between 5 and 480 minutes.' }
  if (input.title.length > 160 || input.description.length > 2000) return { ok: false, message: 'Keep the title under 160 characters and description under 2000 characters.' }
  if (!['urgent', 'high', 'medium', 'low'].includes(input.priority) || !['pending', 'blocked', 'completed'].includes(input.status)) return { ok: false, message: 'Choose a valid priority and status.' }
  const record = { ...input, id: input.id ?? createId(), title: input.title.trim(), owner: input.owner.trim() }
  return { ok: true, value: { action: { type: 'task', task: record }, record } }
}
export function prepareEvent(input: EventInput, state: WorkspaceState, createId: () => string = () => crypto.randomUUID()): PreparedAction<Event> {
  if (input.id && !state.events.some(event => event.id === input.id)) return { ok: false, message: 'This event is no longer available.' }
  const record = { ...input, id: input.id ?? createId(), title: input.title.trim(), participants: input.participants.map(name => name.trim()).filter(Boolean) }
  const message = eventError(record, state.events)
  if (message) return { ok: false, message }
  if (input.title.length > 120 || input.agenda.length > 3000 || input.participants.join(', ').length > 300 || !['meeting', 'focus', 'class', 'break'].includes(input.category)) return { ok: false, message: 'Check the session title, participants, agenda, and type.' }
  return { ok: true, value: { action: { type: 'event', event: record }, record } }
}

export function prepareFocusTime(taskId: string, date: string, state: WorkspaceState): PreparedAction<Event> {
  const task = state.tasks.find(item => item.id === taskId)
  if (!task || task.status === 'blocked' || task.status === 'completed') return { ok: false, message: 'Choose an open task without a blocker.' }
  return prepareEvent({ title: `Focus: ${task.title}`, date, start: '13:30', end: '14:30', category: 'focus', participants: [], agenda: `Work on ${task.title}.` }, state, () => `recommendation-${task.id}`)
}
