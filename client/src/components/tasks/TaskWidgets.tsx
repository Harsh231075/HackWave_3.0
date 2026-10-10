import { useState } from 'react'
import { ArrowDownWideNarrow, Clock3, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, StatusBadge, type DisplayState } from '@/components/feedback/common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { emptyFilters, filterTasks } from '@/domain/workspace'
import type { Priority, Task, TaskStatus } from '@/domain/types'

export function FilterControls() {
  const { state, dispatch } = useWorkspace()
  const filters = state.filters[state.role]
  const [expanded, setExpanded] = useState(false)
  const set = (patch: Partial<typeof filters>) => dispatch({ type: 'filters', role: state.role, patch })
  const contexts = [...new Set(state.tasks.filter(task => task.role === state.role).map(task => task.context))]
  return <div className="task-filters"><div className="filter-primary"><div className="search-field"><Search size={15} /><Input aria-label="Search tasks" placeholder="Search tasks or owners…" value={filters.query} onChange={event => set({ query: event.target.value })} /></div><Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><SlidersHorizontal size={14} /> Filters</Button><label className="sort-control"><ArrowDownWideNarrow size={14} /><select aria-label="Sort tasks" value={filters.sort} onChange={event => set({ sort: event.target.value as 'due' | 'priority' })}><option value="due">Due date</option><option value="priority">Priority</option></select></label></div>{expanded && <div className="filter-expanded"><label>Status<select value={filters.status} onChange={event => set({ status: event.target.value })}><option value="all">All statuses</option><option value="pending">Pending</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></label><label>Priority<select value={filters.priority} onChange={event => set({ priority: event.target.value })}><option value="all">All priorities</option>{['urgent', 'high', 'medium', 'low'].map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Context<select value={filters.context} onChange={event => set({ context: event.target.value })}><option value="all">All contexts</option>{contexts.map(context => <option key={context}>{context}</option>)}</select></label><label>Due from<input type="date" value={filters.from} onChange={event => set({ from: event.target.value })} /></label><label>Due through<input type="date" value={filters.to} min={filters.from} onChange={event => set({ to: event.target.value })} /></label><Button variant="ghost" size="sm" onClick={() => set(emptyFilters())}><X size={14} /> Reset</Button></div>}</div>
}
export function TaskCard({ task, compact = false, onSelect }: { task: Task; compact?: boolean; onSelect: (task: Task) => void }) {
  const { dispatch } = useWorkspace()
  const overdue = task.due < DEMO_DATE && task.status !== 'completed'
  return <div className={`task-row ${compact ? 'task-compact' : ''} ${task.status === 'completed' ? 'task-completed' : ''}`}><Checkbox checked={task.status === 'completed'} onCheckedChange={() => dispatch({ type: 'toggle', id: task.id })} aria-label={`Complete ${task.title}`} /><button className="task-name" onClick={() => onSelect(task)}><span>{task.title}</span><small>{task.context}{compact ? '' : ` · ${task.owner}`}</small></button><div className="task-meta"><StatusBadge tone={task.priority}>{task.priority}</StatusBadge>{!compact && <span className="task-duration"><Clock3 size={12} />{task.duration}m</span>}<span className={overdue ? 'overdue-text' : 'due-text'}>{overdue ? 'Overdue' : task.due === DEMO_DATE ? 'Today' : format(parseISO(task.due), 'MMM d')}</span></div><Button size="icon-sm" variant="ghost" aria-label={`Edit ${task.title}`} onClick={() => onSelect(task)}><MoreHorizontal size={16} /></Button></div>
}
export function TaskList({ overdueOnly = false, displayState }: { overdueOnly?: boolean; displayState?: DisplayState }) {
  const { state } = useWorkspace()
  const [selected, setSelected] = useState<Task | undefined>()
  const [open, setOpen] = useState(false)
  const tasks = filterTasks(state.tasks, state.role, state.filters[state.role], DEMO_DATE).filter(task => !overdueOnly || (task.due < DEMO_DATE && task.status !== 'completed'))
  return <><div className="section-actions"><span className="subtle-label">{tasks.length} tasks · shared across your workspace</span><Button size="sm" variant="outline" onClick={() => { setSelected(undefined); setOpen(true) }}><Plus size={14} /> New task</Button></div><FilterControls /><DataState state={displayState ?? (tasks.length ? 'ready' : 'empty')} empty="No tasks match these filters. Try resetting them."><div className="task-list">{tasks.map(task => <TaskCard key={task.id} task={task} onSelect={task => { setSelected(task); setOpen(true) }} />)}</div></DataState><TaskForm key={`${selected?.id ?? 'new'}-${open}`} open={open} onClose={() => setOpen(false)} task={selected} /></>
}
export function TaskForm({ open, onClose, task }: { open: boolean; onClose: () => void; task?: Task }) {
  const { state, dispatch, notify } = useWorkspace()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [due, setDue] = useState(task?.due ?? DEMO_DATE)
  const [duration, setDuration] = useState(task?.duration ?? 30)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending')
  const [owner, setOwner] = useState(task?.owner ?? 'Maya')
  const contexts = [...new Set(state.tasks.filter(item => item.role === state.role).map(item => item.context))]
  const [context, setContext] = useState(task?.context ?? contexts[0])
  const [error, setError] = useState('')
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{task ? 'Task details' : 'Create a task'}</DialogTitle><DialogDescription>Demo workspace · saved changes last until reload.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={event => {
    event.preventDefault()
    if (!title.trim() || !owner.trim() || !due || !Number.isFinite(duration) || duration < 5 || duration > 480) { setError('Add a title, owner, due date, and duration between 5 and 480 minutes.'); return }
    dispatch({ type: 'task', task: { id: task?.id ?? crypto.randomUUID(), role: state.role, title: title.trim(), description, due, duration, priority, status, owner: owner.trim(), context } })
    notify(task ? 'Task updated across your workspace.' : 'Task created in your workspace.'); onClose()
  }}><label>Task title<Input value={title} onChange={event => setTitle(event.target.value)} required maxLength={160} autoFocus /></label><label>Description<Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={2000} /></label><div className="form-grid"><label>Due date<Input type="date" value={due} onChange={event => setDue(event.target.value)} required /></label><label>Estimated minutes<Input type="number" min={5} max={480} value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value as Priority)}>{['urgent', 'high', 'medium', 'low'].map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>{['pending', 'blocked', 'completed'].map(value => <option key={value}>{value}</option>)}</select></label><label>Context<select value={context} onChange={event => setContext(event.target.value)}>{contexts.map(value => <option key={value}>{value}</option>)}</select></label><label>Owner<Input value={owner} onChange={event => setOwner(event.target.value)} required /></label></div>{error && <p className="field-error" role="alert">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{task ? 'Save changes' : 'Create task'}</Button></DialogFooter></form></DialogContent></Dialog>
}
export function PriorityBoard() {
  const { state, dispatch } = useWorkspace()
  const [selected, setSelected] = useState<Task>()
  const tasks = filterTasks(state.tasks, state.role, state.filters[state.role], DEMO_DATE).filter(task => task.status !== 'completed')
  return <><div className="priority-board">{(['urgent', 'high', 'medium', 'low'] as Priority[]).map(priority => <section key={priority} className="priority-column"><h3><span className={`priority-dot tone-${priority}`} />{priority}<span>{tasks.filter(task => task.priority === priority).length}</span></h3>{tasks.filter(task => task.priority === priority).map(task => <article className="board-card" key={task.id}><button onClick={() => setSelected(task)}>{task.title}</button><small>{task.context}</small><div><StatusBadge tone={task.status === 'blocked' ? 'urgent' : 'neutral'}>{task.status}</StatusBadge><label className="sr-only" htmlFor={`priority-${task.id}`}>Priority for {task.title}</label><select id={`priority-${task.id}`} value={task.priority} onChange={event => dispatch({ type: 'task', task: { ...task, priority: event.target.value as Priority } })}>{['urgent', 'high', 'medium', 'low'].map(value => <option key={value}>{value}</option>)}</select></div><span className={task.due < DEMO_DATE ? 'overdue-text' : 'due-text'}>{format(parseISO(task.due), 'MMM d')} · {task.owner}</span></article>)}{!tasks.some(task => task.priority === priority) && <p className="board-empty">No {priority} tasks</p>}</section>)}</div><TaskForm key={selected?.id ?? 'closed'} open={!!selected} onClose={() => setSelected(undefined)} task={selected} /></>
}
