import { useContext } from 'react'
import { ActionOriginContext } from '@/lib/workspace/WorkspaceActionContext'
import { filterTasks } from '@/domain/workspace'
import { useComponentView } from '@/state/ComponentViewContext'
import type { TaskInput, ActionResult } from '@/domain/commands'
import { useUsageScope } from '@/state/UsageScopeContext'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { workspaceActionService } from '@/services'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { useState } from 'react'
import { ArrowDownWideNarrow, Clock3, MoreHorizontal, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, StatusBadge, type DisplayState } from '@/components/feedback/common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { emptyFilters } from '@/domain/workspace'
import type { Priority, Task, TaskStatus } from '@/domain/types'

export function FilterControls() {
  const meeting = useMeetingScope()
  const usage = useUsageScope()
  const overdue = useOverdueScope()
  const { state, updateFilters } = useWorkspace()
  const filters = usage?.filters ?? overdue?.filters ?? meeting?.filters ?? state.filters
  const [expanded, setExpanded] = useState(false)
  const set = (patch: Partial<typeof filters>) => (usage?.updateFilters ?? overdue?.updateFilters ?? meeting?.updateFilters ?? updateFilters)(patch)
  return <div className="flex flex-col gap-3 mb-4"><div className="flex items-center gap-3"><div className="flex items-center gap-2 bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0_0.75rem] flex-1 [&_input]:bg-transparent [&_input]:border-0 [&_input]:outline-none [&_input]:text-[length:0.88rem] [&_input]:[padding:0.45rem_0] [&_input]:w-full"><Search size={15} /><Input aria-label="Search tasks" placeholder="Search tasks or owners…" value={filters.query} onChange={event => set({ query: event.target.value })} /></div><Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><SlidersHorizontal size={14} /> Filters</Button><label className="inline-flex items-center [gap:0.4rem] bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0.4rem_0.75rem] text-[length:0.84rem] text-(--muted-foreground) [&_select]:bg-transparent [&_select]:border-0 [&_select]:outline-none [&_select]:text-(--foreground) [&_select]:text-[length:0.84rem] [&_select]:cursor-pointer"><ArrowDownWideNarrow size={14} /><select aria-label="Sort tasks" value={filters.sort} onChange={event => set({ sort: event.target.value as 'due' | 'priority' })}><option value="due">Due date</option><option value="priority">Priority</option></select></label></div>{expanded && <div className="flex gap-3 flex-wrap [padding:0.85rem] bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] text-[length:0.82rem] [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_label]:font-medium [&_select]:bg-(--card) [&_select]:[border:1px_solid_var(--border)] [&_select]:[border-radius:4px] [&_select]:[padding:0.35rem_0.55rem] [&_select]:text-[length:0.82rem] [&_select]:text-(--foreground) [&_input]:bg-(--card) [&_input]:[border:1px_solid_var(--border)] [&_input]:[border-radius:4px] [&_input]:[padding:0.35rem_0.55rem] [&_input]:text-[length:0.82rem] [&_input]:text-(--foreground)"><label>Status<select value={filters.status} onChange={event => set({ status: event.target.value })}><option value="all">All statuses</option><option value="pending">Pending</option><option value="blocked">Blocked</option><option value="completed">Completed</option><option value="overdue">Overdue</option></select></label><label>Priority<select value={filters.priority} onChange={event => set({ priority: event.target.value })}><option value="all">All priorities</option>{['urgent', 'high', 'medium', 'low'].map(priority => <option key={priority} value={priority}>{priority}</option>)}</select></label><label>Due from<input type="date" value={filters.from} onChange={event => set({ from: event.target.value })} /></label><label>Due through<input type="date" value={filters.to} min={filters.from} onChange={event => set({ to: event.target.value })} /></label><Button variant="ghost" size="sm" onClick={() => set(emptyFilters())}><X size={14} /> Reset</Button></div>}</div>
}
export function TaskCard({ task, compact = false, onSelect }: { task: Task; compact?: boolean; onSelect: (task: Task) => void }) {
  const { toggleTask } = useWorkspace()
  const overdue = task.due < DEMO_DATE && task.status !== 'completed'
  return <div className={`shared-task-row flex items-center gap-3 [padding:0.75rem_0.9rem] bg-(--background) [border:1px_solid_var(--border)] rounded-[var(--radius)] [transition:all_0.15s] hover:bg-(--surface-hover) hover:border-(--ring) [&.task-completed]:opacity-60 [&.task-completed_.task-name_span]:line-through ${compact ? 'task-compact' : ''} ${task.status === 'completed' ? 'task-completed' : ''}`}><Checkbox checked={task.status === 'completed'} onCheckedChange={() => toggleTask(task.id)} aria-label={`Complete ${task.title}`} /><button className="task-name min-w-0 flex-1 flex flex-col text-left text-[length:0.92rem] font-medium [&_small]:text-[length:0.78rem] [&_small]:text-(--muted-foreground) [&_small]:font-normal" onClick={() => onSelect(task)}><span>{task.title}</span><small>{task.owner}</small></button><div className="flex items-center [gap:0.65rem] text-[length:0.82rem]"><StatusBadge tone={task.priority}>{task.priority}</StatusBadge>{!compact && <span className="inline-flex items-center [gap:0.3rem] text-(--muted-foreground)"><Clock3 size={12} />{task.duration}m</span>}<span className={overdue ? '[color:#ef4444] font-semibold' : 'text-(--muted-foreground)'}>{overdue ? 'Overdue' : task.due === DEMO_DATE ? 'Today' : format(parseISO(task.due), 'MMM d')}</span></div><Button size="icon-sm" variant="ghost" aria-label={`Edit ${task.title}`} onClick={() => onSelect(task)}><MoreHorizontal size={16} /></Button></div>
}
export function TaskList({ overdueOnly = false, displayState }: { overdueOnly?: boolean; displayState?: DisplayState }) {
  const usage = useUsageScope()
  const scope = useMeetingScope()
  const overdue = useOverdueScope()
  const { state } = useWorkspace()
  const [selected, setSelected] = useState<Task | undefined>()
  const [open, setOpen] = useState(false)
  const { taskView: view, setTaskView: setView } = useDisplayPreferences()
  const component = useComponentView()
  const tasks = (usage ? usage.tasks : overdue?.tasks ?? scope?.tasks ?? filterTasks(state.tasks, state.filters, component?.plan.referenceDate ?? DEMO_DATE)).filter(task => !overdueOnly || (task.due < DEMO_DATE && task.status !== 'completed'))
  const controls = <><span className="text-xs text-muted-foreground">{tasks.length} tasks</span><Select items={[{ value: 'list', label: 'List' }, { value: 'kanban', label: 'Kanban' }]} value={view} onValueChange={next => { if (next !== 'list' && next !== 'kanban') return; setView(next) }}><SelectTrigger size="sm" aria-label="Task view"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="list">List</SelectItem><SelectItem value="kanban">Kanban</SelectItem></SelectContent></Select><Button size="sm" variant="outline" disabled={!!usage || !!scope || !!overdue} title={scope ? "Create tasks on the Tasks page; assigning new tasks to a meeting is not available yet." : undefined} onClick={() => { setSelected(undefined); setOpen(true) }}><Plus size={14} /> New task</Button></>
  return <><WidgetActions>{controls}</WidgetActions><FilterControls /><DataState state={displayState ?? (tasks.length ? 'ready' : 'empty')} empty="No tasks match these filters. Try resetting them.">{view === 'list' ? <div className="flex flex-col gap-2" data-task-view="list">{tasks.map(task => <TaskCard key={task.id} task={task} onSelect={task => { setSelected(task); setOpen(true) }} />)}</div> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-task-view="kanban">{(['pending', 'blocked', 'completed'] as TaskStatus[]).map(status => <section key={status} className="min-w-0 rounded-lg bg-muted p-3"><h3 className="mb-3 flex justify-between text-sm font-medium capitalize">{status}<span>{tasks.filter(task => task.status === status).length}</span></h3><div className="flex flex-col gap-2">{tasks.filter(task => task.status === status).map(task => <TaskCard key={task.id} task={task} compact onSelect={task => { setSelected(task); setOpen(true) }} />)}</div></section>)}</div>}</DataState><TaskForm key={`${selected?.id ?? 'new'}-${open}`} open={open} onClose={() => setOpen(false)} task={selected} /></>
}
export function TaskForm({ open, onClose, task, onSave }: { open: boolean; onClose: () => void; task?: Task; onSave?: (input: TaskInput) => ActionResult<Task> }) {
  const { saveTask, notify } = useWorkspace()
  const origin = useContext(ActionOriginContext)
  const [prepared] = useState(() => task && origin ? workspaceActionService.prepare({ type: 'task.edit', taskId: task.id }, origin) : null)
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [due, setDue] = useState(task?.due ?? DEMO_DATE)
  const [duration, setDuration] = useState(task?.duration ?? 30)
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'pending')
  const [owner, setOwner] = useState(task?.owner ?? 'Maya')
  const [error, setError] = useState('')
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{task ? 'Task details' : 'Create a task'}</DialogTitle><DialogDescription>Changes are saved on this device.</DialogDescription></DialogHeader><form className="flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:[gap:0.35rem] [&_label]:text-[length:0.84rem] [&_label]:font-medium [&_select]:bg-(--background) [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-[var(--radius)] [&_select]:[padding:0.5rem_0.75rem] [&_select]:text-[length:0.88rem] [&_select]:text-(--foreground) [&_input]:bg-(--background) [&_input]:[border:1px_solid_var(--border)] [&_input]:rounded-[var(--radius)] [&_input]:[padding:0.5rem_0.75rem] [&_input]:text-[length:0.88rem] [&_input]:text-(--foreground) [&_textarea]:bg-(--background) [&_textarea]:[border:1px_solid_var(--border)] [&_textarea]:rounded-[var(--radius)] [&_textarea]:[padding:0.5rem_0.75rem] [&_textarea]:text-[length:0.88rem] [&_textarea]:text-(--foreground)" onSubmit={event => {
    event.preventDefault()
    const save = onSave ?? (prepared ? (input: TaskInput) => prepared.ok && prepared.value.type === 'task.edit' ? workspaceActionService.saveTask(prepared.value, input) : { ok: false as const, message: 'This task is no longer available in the original view.' } : saveTask)
    const result = save({ id: task?.id, title, description, due, duration, priority, status, owner })
    if (!result.ok) { setError(result.message); return }
    notify(task ? 'Task updated across your workspace.' : 'Task created in your workspace.'); onClose()
  }}><label>Task title<Input value={title} onChange={event => setTitle(event.target.value)} required maxLength={160} autoFocus /></label><label>Description<Textarea value={description} onChange={event => setDescription(event.target.value)} rows={3} maxLength={2000} /></label><div className="grid grid-cols-2 [gap:0.85rem]"><label>Due date<Input type="date" value={due} onChange={event => setDue(event.target.value)} required /></label><label>Estimated minutes<Input type="number" min={5} max={480} value={duration} onChange={event => setDuration(Number(event.target.value))} /></label><label>Priority<select value={priority} onChange={event => setPriority(event.target.value as Priority)}>{['urgent', 'high', 'medium', 'low'].map(value => <option key={value}>{value}</option>)}</select></label><label>Status<select value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>{['pending', 'blocked', 'completed'].map(value => <option key={value}>{value}</option>)}</select></label><label>Owner<Input value={owner} onChange={event => setOwner(event.target.value)} required /></label></div>{error && <p className="[color:#ef4444] text-[length:0.8rem] font-medium" role="alert">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{task ? 'Save changes' : 'Create task'}</Button></DialogFooter></form></DialogContent></Dialog>
}
