import type { DomainSnapshot, Event, Filters, Task, WorkspaceState } from './types.ts'

export const emptyFilters = (): Filters => ({ query: '', status: 'all', priority: 'all', context: 'all', sort: 'due', from: '', to: '' })
export const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
export function filterTasks(tasks: Task[], filters: Filters, today: string) {
  return tasks.filter(task => `${task.title} ${task.description} ${task.owner}`.toLowerCase().includes(filters.query.toLowerCase())
    && (filters.status === 'all' || (filters.status === 'overdue' ? task.due < today && task.status !== 'completed' : task.status === filters.status))
    && (filters.priority === 'all' || task.priority === filters.priority)
    && (filters.context === 'all' || task.context === filters.context)
    && (!filters.from || task.due >= filters.from) && (!filters.to || task.due <= filters.to))
    .sort((a, b) => filters.sort === 'priority' ? priorityOrder[a.priority] - priorityOrder[b.priority] : a.due.localeCompare(b.due))
}
export function minutes(time: string) { const [hour, minute] = time.split(':').map(Number); return hour * 60 + minute }
export function eventError(event: Event, events: Event[]): string | null {
  if (!event.title.trim()) return 'Add a title for this session.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date) || Number.isNaN(Date.parse(`${event.date}T12:00:00`))) return 'Choose a valid date.'
  const validTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/
  if (!validTime.test(event.start) || !validTime.test(event.end) || minutes(event.end) <= minutes(event.start)) return 'End time must be after start time.'
  if (events.some(other => other.id !== event.id && other.date === event.date && minutes(other.start) < minutes(event.end) && minutes(event.start) < minutes(other.end))) return 'This time overlaps an existing session. Choose another slot.'
  return null
}
export type Action =
  | { type: 'filters'; patch: Partial<Filters> }
  | { type: 'task'; task: Task } | { type: 'toggle'; id: string }
  | { type: 'event'; event: Event } | { type: 'draft'; key: string; value: string }
  | { type: 'dismiss'; id: string } | { type: 'pin'; id: string }
  | { type: 'undo' } | { type: 'reset'; state: WorkspaceState }
function snapshot(state: WorkspaceState): DomainSnapshot {
  return { tasks: state.tasks, events: state.events, drafts: state.drafts, dismissed: state.dismissed, activity: state.activity }
}
export function workspaceReducer(state: WorkspaceState, action: Action): WorkspaceState {
  if (action.type === 'filters') return { ...state, filters: { ...state.filters, ...action.patch } }
  if (action.type === 'pin') return { ...state, pins: state.pins.includes(action.id) ? state.pins.filter(id => id !== action.id) : [...state.pins, action.id] }
  if (action.type === 'reset') return action.state
  if (action.type === 'undo') { const previous = state.history.at(-1); return previous ? { ...state, ...previous, history: state.history.slice(0, -1) } : state }
  let next: DomainSnapshot = snapshot(state)
  let message = ''
  if (action.type === 'task') {
    const exists = state.tasks.some(task => task.id === action.task.id)
    next = { ...next, tasks: exists ? state.tasks.map(task => task.id === action.task.id ? action.task : task) : [...state.tasks, action.task] }
    message = `${exists ? 'Updated' : 'Created'} “${action.task.title}”`
  }
  if (action.type === 'toggle') {
    const target = state.tasks.find(task => task.id === action.id)
    if (!target) return state
    next = { ...next, tasks: state.tasks.map(task => task.id === action.id ? { ...task, status: task.status === 'completed' ? 'pending' : 'completed' } : task) }
    message = `${target.status === 'completed' ? 'Reopened' : 'Completed'} “${target.title}”`
  }
  if (action.type === 'event') {
    if (eventError(action.event, state.events)) return state
    next = { ...next, events: [...state.events.filter(event => event.id !== action.event.id), action.event] }
    message = `Scheduled “${action.event.title}”`
  }
  if (action.type === 'draft') { next = { ...next, drafts: { ...state.drafts, [action.key]: action.value } }; message = 'Saved your preparation outline' }
  if (action.type === 'dismiss') { next = { ...next, dismissed: [...state.dismissed, action.id] }; message = 'Dismissed a recommendation' }
  return { ...state, ...next, activity: [message, ...state.activity].slice(0, 12), history: [...state.history, snapshot(state)].slice(-20) }
}
