import { calendarDate } from '@/domain/calendar'
import { getActivityRecords } from '@/services/recordHistory'
import { browserDatabase, adaptiveDataService } from '@/services'
import { TaskCard, TaskForm } from '@/components/tasks/TaskWidgets'
import { MeetingDetails } from '@/components/calendar/CalendarWidgets'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Task, Event } from '@/domain/types'
import { shiftDate } from '@/domain/calendar'
import { useComponentView } from '@/state/ComponentViewContext'
import { useUsageScope } from '@/state/UsageScopeContext'
import { DataUsageExplorer } from './UsageExplorer'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CheckCheck, Clock3, ListTodo, TriangleAlert, TrendingUp } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { minutes } from '@/domain/workspace'
import { DataState, type DisplayState } from '@/components/feedback/common'

export function MetricCard({ title, value, description, icon: Icon, tone = 'neutral', displayState, onInspect }: { title: string; value: string | number; description: string; icon: typeof ListTodo; tone?: string; displayState?: DisplayState; onInspect?:()=>void }) {
  return <article className={`bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] p-5 flex flex-col [gap:0.45rem] shadow-[var(--shadow-sm)] [&_strong]:text-[length:1.9rem] [&_strong]:font-bold [&_strong]:leading-[1.1] [&_strong]:tracking-[-0.02em] [&_p]:text-[length:0.78rem] [&_p]:text-(--muted-foreground) [&.metric-success_strong]:[color:#4c856b] [&.metric-warning_strong]:[color:#ef4444] metric-${tone}`}><DataState state={displayState}><div className="flex justify-between items-center text-[length:0.84rem] font-medium text-(--muted-foreground)"><span>{title}</span><Icon size={17} /></div><strong>{value}</strong><p>{description}</p>{onInspect&&<Button variant="ghost" size="sm" onClick={onInspect}>View records</Button>}</DataState></article>
}
export function Metrics() {
  const usage = useUsageScope()
  const scope = useOverdueScope()
  const { state } = useWorkspace()
  const tasks = state.tasks
  const [inspection,setInspection]=useState<{title:string;tasks?:Task[];events?:Event[]}|null>(null)
  const [selectedTask,setSelectedTask]=useState<Task>()
  const [selectedEvent,setSelectedEvent]=useState<Event>()
  const component = useComponentView()
  const today = component?.plan.referenceDate ?? DEMO_DATE
  const completed = tasks.filter(task=>task.status==='completed').length
  const overdue = tasks.filter(task => task.status !== 'completed' && task.due < today).length
  const focus = state.events.filter(event => event.date === (component?.plan.bindings.selectedDate ?? today) && event.category === 'focus').reduce((sum, event) => sum + minutes(event.end) - minutes(event.start), 0)
  if (usage) return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{usage.data.periodComparisons.map(c => <MetricCard key={c.segment} title={c.segment + ' daily average'} value={c.currentAverage === null ? 'Unknown' : c.currentAverage.toLocaleString('en', { maximumFractionDigits: 1 })} description={c.explanation} icon={TrendingUp} />)}<MetricCard title="Measurements" value={usage.data.observations.length} description="Records within this scope" icon={ListTodo} /><MetricCard title="Release records" value={usage.data.releases.length} description="Timing evidence, not causal proof" icon={Clock3} /></div>
  if (scope) return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><MetricCard title="Overdue tasks" value={scope.tasks.length} description="Matching this project review" icon={ListTodo} /><MetricCard title="Blocked" value={scope.tasks.filter(t => t.status === 'blocked').length} description="Resolve blockers first" icon={TriangleAlert} /><MetricCard title="Owners" value={new Set(scope.tasks.map(t => t.owner)).size} description="Across matching tasks" icon={CheckCheck} /><MetricCard title="Remaining effort" value={`${scope.tasks.reduce((sum,t) => sum+t.duration,0)}m`} description="Estimated task duration" icon={Clock3} /></div>
  return <><div className="grid grid-cols-4 gap-5 w-full [@media(width<=900px)]:grid-cols-2 [@media(width<=480px)]:grid-cols-1"><MetricCard onInspect={()=>setInspection({title:'Open tasks',tasks:tasks.filter(t=>t.status!=='completed')})} title="Open tasks" value={tasks.length - completed} description="A clear list of what’s next" icon={ListTodo} /><MetricCard onInspect={()=>setInspection({title:'Completed tasks',tasks:tasks.filter(t=>t.status==='completed')})} title="Completed" value={completed} description={`${Math.round(completed / Math.max(tasks.length, 1) * 100)}% of selected tasks complete`} icon={CheckCheck} tone="success" /><MetricCard onInspect={()=>setInspection({title:'Overdue tasks',tasks:tasks.filter(t=>t.status!=='completed'&&t.due<today)})} title="Needs attention" value={overdue} description="Overdue tasks to revisit" icon={TriangleAlert} tone="warning" /><MetricCard onInspect={()=>setInspection({title:'Focus events',events:state.events.filter(e=>e.date===(component?.plan.bindings.selectedDate??today)&&e.category==='focus')})} title="Focus time" value={`${(focus / 60).toFixed(1)}h`} description={'Local calendar · '+(component?.plan.bindings.selectedDate??today)} icon={Clock3} /></div><Dialog open={!!inspection} onOpenChange={open=>{if(!open)setInspection(null)}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{inspection?.title}</DialogTitle><DialogDescription>Records from this component’s current scope.</DialogDescription></DialogHeader>{inspection?.tasks?.map(task=><TaskCard key={task.id} task={task} onSelect={setSelectedTask}/>)}{inspection?.events?.map(event=><Button key={event.id} variant="outline" onClick={()=>setSelectedEvent(event)}>{event.title} · {event.start}–{event.end}</Button>)}{!(inspection?.tasks?.length||inspection?.events?.length)&&<p>No matching records.</p>}</DialogContent></Dialog>{selectedTask&&<TaskForm key={selectedTask.id} open task={state.tasks.find(t=>t.id===selectedTask.id)??selectedTask} onClose={()=>setSelectedTask(undefined)}/>}<MeetingDetails event={selectedEvent?state.events.find(e=>e.id===selectedEvent.id):undefined} onClose={()=>setSelectedEvent(undefined)}/></>
}
const palette = ['#456a52', '#88a58d', '#d6c6a5', '#b8c5b1']
export function ProductivityChart({ displayState }: { displayState?: DisplayState }) {
  const { state, selectDate:setDate, selectedDate } = useWorkspace()
  const component = useComponentView()
  const [localType, setLocalType] = useState<'trend' | 'comparison' | 'allocation'>('trend')
  const type = component?.plan.bindings.chartType ?? localType
  const setType = (value: 'trend'|'comparison'|'allocation') => component ? component.change({chartType:value}) : setLocalType(value)
  const today = component?.plan.bindings.selectedDate ?? component?.plan.referenceDate ?? selectedDate ?? calendarDate()
  const b=component?.plan.bindings,scope=adaptiveDataService.snapshot()
  const projectIds=new Set((scope?.projects??[]).filter(p=>(!b?.projectId||p.id===b.projectId)&&(!b?.clientId||p.clientId===b.clientId)).map(p=>p.id))
  const records=getActivityRecords(browserDatabase).filter(r=>!b?.projectId&&!b?.clientId||scope?.relationships.some(link=>link.sourceKind==='project'&&projectIds.has(link.sourceId)&&link.targetKind==='task'&&link.targetId===r.entityId))
  const end=component?.plan.bindings.dateRange?.to??today,start=component?.plan.bindings.dateRange?.from??shiftDate(end,-6)
  const length=Math.min(366,Math.max(1,Math.round((Date.parse(end)-Date.parse(start))/86400000)+1))
  const chartData=Array.from({length},(_,index)=>{const date=shiftDate(start,index);return {day:date.slice(5),date,completed:records.filter(r=>r.completion&&calendarDate(new Date(r.at),component?.plan.timezone??'Asia/Kolkata')===date).length,pending:state.tasks.filter(t=>t.status!=='completed'&&t.due===date).length}})
  const allocation = Object.entries(state.events.filter(event => event.date === today).reduce<Record<string, number>>((counts, event) => ({ ...counts, [event.category]: (counts[event.category] ?? 0) + minutes(event.end) - minutes(event.start) }), {})).map(([name, value]) => ({ name, value }))
  return <><div className="flex flex-wrap gap-3 justify-between items-center mb-4 [&_select]:bg-(--muted) [&_select]:[border:1px_solid_var(--border)] [&_select]:[padding:0.35rem_0.65rem] [&_select]:rounded-[var(--radius)] [&_select]:text-[length:0.82rem] [&_select]:text-(--foreground)"><div><strong>{type === 'allocation' ? 'Selected day’s time allocation' : 'Recorded completion activity'}</strong><p className="text-[length:0.78rem] text-(--muted-foreground)">{type === 'allocation' ? 'Derived from local calendar events' : 'Recorded completions; pending deadlines use current task status'}</p></div><label className="text-xs">End date<Input type="date" value={today} onChange={e=>{if(e.target.value){if(component)component.change({selectedDate:e.target.value,dateRange:undefined});else setDate(e.target.value)}}}/></label><select aria-label="Chart type" value={type} onChange={event => setType(event.target.value as typeof type)}><option value="trend">Completion trend</option><option value="comparison">Recorded completions vs current pending deadlines</option><option value="allocation">Time allocation</option></select></div><DataState state={displayState ?? ((type==='allocation'?allocation.length:chartData.some(r=>r.completed>0||(type==='comparison'&&r.pending>0)))?'ready':'empty')} empty="No records match this date range."><div className="w-full [margin:0.5rem_0]" role="img" aria-label={type === 'allocation' ? allocation.map(item => `${item.name}: ${item.value} minutes`).join(', ') : chartData.map(r=>r.date+': '+r.completed+' completion actions').join(', ')}><ResponsiveContainer width="100%" height={220}>{type === 'allocation' ? <PieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={4}>{allocation.map((item, index) => <Cell key={item.name} fill={palette[index % palette.length]} />)}</Pie><Tooltip /></PieChart> : type === 'comparison' ? <BarChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip /><Bar dataKey="completed" fill={palette[0]} radius={[4, 4, 0, 0]} /><Bar dataKey="pending" fill={palette[2]} radius={[4, 4, 0, 0]} /></BarChart> : <AreaChart data={chartData} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}><defs><linearGradient id="completion-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={palette[0]} stopOpacity={0.18} /><stop offset="100%" stopColor={palette[0]} stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="completed" stroke={palette[0]} strokeWidth={2} fill="url(#completion-fill)" /></AreaChart>}</ResponsiveContainer></div><div className="flex items-center [gap:0.45rem] text-[length:0.82rem] text-(--muted-foreground) mt-3 [padding-top:0.65rem] [border-top:1px_solid_var(--border)]"><TrendingUp size={15} /><span>{type === 'allocation' ? allocation.map(item => `${item.name}: ${item.value}m`).join(' · ') : `${chartData.reduce((sum,item)=>sum+item.completed,0)} completion actions in ${chartData.length} selected days. Reopened or undone work remains recorded as past activity; current status is shown in Summary.`}</span></div></DataState></>
}
export function UsageExplorer() {
  const scope = useUsageScope()
  const component = useComponentView()
  return <DataUsageExplorer initialQuery={component?.plan.bindings.clientId ? {clientId:component.plan.bindings.clientId,projectId:component.plan.bindings.projectId,dateRange:component.plan.bindings.dateRange} : undefined} boundQuery={scope?.data.snapshot.query} />
}
