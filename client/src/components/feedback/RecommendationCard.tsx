import { TaskForm } from '@/components/tasks/TaskWidgets'
import { MeetingDetails } from '@/components/calendar/CalendarWidgets'
import { getActivityRecords } from '@/services/recordHistory'
import { browserDatabase } from '@/services'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { useWorkspaceActions } from '@/lib/workspace/WorkspaceActionContext'
import { useComponentView } from '@/state/ComponentViewContext'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { OverdueRecovery } from '@/components/tasks/OverdueWidgets'
import { Button } from '@/components/ui/button'
import { DataState } from './common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'

export function RecommendationCard() {
  const scope = useOverdueScope()
  return scope ? <OverdueRecovery /> : <GeneralRecommendationCard />
}
function GeneralRecommendationCard() {
  const { state, selectedDate, dismissRecommendation, restoreRecommendation } = useWorkspace()
  const actions = useWorkspaceActions()
  const component = useComponentView()
  const today = component?.plan.referenceDate ?? DEMO_DATE
  const task = state.tasks.filter(task => task.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due))[0]
  if (!task) return <DataState state="empty" empty="All caught up. There’s no outstanding work to recommend."><span /></DataState>
  const id = `recommendation-${task.id}`
  if (state.dismissed.includes(id)) return <div><p className="text-sm text-muted-foreground">Recommendation dismissed.</p><Button size="sm" variant="outline" onClick={()=>restoreRecommendation(id)}>Restore suggestion</Button></div>
  return <div className="space-y-3 rounded-lg bg-accent/50 p-4">
    <h3 className="font-medium">Make space for {task.title.toLowerCase()}.</h3>
    <p className="text-sm text-muted-foreground">{task.due < today ? `Overdue since ${task.due}.` : `Due ${task.due}.`} Estimated work: {task.duration} minutes.</p>
    <p className="text-xs text-muted-foreground">Choose an available slot and confirm a local focus block. Google Calendar is unchanged.</p>
    <div className="flex gap-2"><Button size="sm" disabled={!actions || actions.pending || task.status !== 'pending'} onClick={() => actions?.dispatch({ type: 'focus.schedule', taskId: task.id, date: selectedDate })}>Schedule focus</Button><Button size="sm" variant="ghost" onClick={() => dismissRecommendation(id)}>Dismiss</Button></div>
    {task.status === 'blocked' && <p className="text-xs text-muted-foreground">Resolve the blocker before scheduling focus.</p>}
  </div>
}
export function RecentActivity() {
  const {state}=useWorkspace()
  const [taskId,setTaskId]=useState(''),[eventId,setEventId]=useState('')
  const [expanded,setExpanded]=useState(false),[date,setDate]=useState(''),[kind,setKind]=useState('')
  const records=getActivityRecords(browserDatabase).filter(r=>(!date||new Date(r.at).toLocaleDateString('en-CA')===date)&&(!kind||r.kind===kind))
  return <div className="space-y-3"><Button size="sm" variant="outline" onClick={()=>setExpanded(!expanded)}>{expanded?'Show latest':'Full activity history'}</Button>{expanded&&<div className="flex gap-2"><Input aria-label="Activity date" type="date" value={date} onChange={e=>setDate(e.target.value)}/><select aria-label="Activity type" className="rounded border p-2" value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option>{[...new Set(getActivityRecords(browserDatabase).map(r=>r.kind))].map(k=><option key={k} value={k}>{k}</option>)}</select><Button variant="outline" onClick={()=>{setDate('');setKind('')}}>Reset</Button></div>}{records.slice(0,expanded?1000:5).map(r=><article key={r.id} className="rounded border p-3 text-sm"><p>{r.summary}</p><small className="text-muted-foreground">{new Date(r.at).toLocaleString()} · {r.kind} · {r.operation}</small>{r.entityId&&<p className="text-xs text-muted-foreground">Record: {r.entityId}</p>}{r.kind==='task'&&state.tasks.some(t=>t.id===r.entityId)&&<Button size="sm" variant="outline" onClick={()=>setTaskId(r.entityId!)}>Open task</Button>}{r.kind==='event'&&state.events.some(e=>e.id===r.entityId)&&<Button size="sm" variant="outline" onClick={()=>setEventId(r.entityId!)}>Open event</Button>}</article>)}{!records.length&&<p className="text-sm text-muted-foreground">No recorded changes match this selection.</p>}{!expanded&&state.activity.length>0&&<details className="text-xs text-muted-foreground"><summary>Earlier entries without timestamps</summary>{state.activity.map((item,index)=><p key={index}>{item}</p>)}</details>}{taskId&&state.tasks.some(t=>t.id===taskId)&&<TaskForm key={taskId} task={state.tasks.find(t=>t.id===taskId)} open onClose={()=>setTaskId('')}/>}<MeetingDetails event={state.events.find(e=>e.id===eventId)} onClose={()=>setEventId('')}/></div>
}
