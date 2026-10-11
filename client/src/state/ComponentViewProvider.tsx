import { useContext, type ReactNode } from 'react'
import { WorkspaceContext } from './WorkspaceProvider'
import { GoogleCalendarContext } from './GoogleCalendarContext'
import { ComponentViewContext } from './ComponentViewContext'
import { selectViewTasks, selectViewEvents, viewBindingsSchema, type ComponentView, type ViewBindings } from '@/domain/componentIntent'
import type { Filters } from '@/domain/types'
import { adaptiveDataService, resourceService } from '@/services'
export function ComponentViewProvider({plan,onChange,children}:{plan:ComponentView;onChange:(bindings:Partial<ViewBindings>)=>void;children:ReactNode}) {
  const workspace=useContext(WorkspaceContext)
  const google=useContext(GoogleCalendarContext)
  if(!workspace)throw new Error('Component views require workspace records.')
  const records=adaptiveDataService.snapshot()
  const b=plan.bindings
  const projects=(records?.projects??[]).filter(p=>(!b.projectId||p.id===b.projectId)&&(!b.clientId||p.clientId===b.clientId))
  const projectIds=new Set(projects.map(p=>p.id))
  const scoped=!!(b.clientId||b.projectId)
  const linked=(kind:string,id:string)=>!scoped||!!records?.relationships.some(r=>r.sourceKind==='project'&&projectIds.has(r.sourceId)&&r.targetKind===kind&&r.targetId===id)
  const query=(value:string)=>!b.recordQuery||value.toLowerCase().includes(b.recordQuery.toLowerCase())
  const resources=resourceService.list().filter(r=>linked('resource',r.id)&&(!b.resourceQuery||`${r.title} ${r.context} ${r.body}`.toLowerCase().includes(b.resourceQuery.toLowerCase())))
  const communications=(records?.communications??[]).filter(r=>(!scoped||projectIds.has(r.projectId))&&(!b.dateRange||(r.date>=b.dateRange.from&&r.date<=b.dateRange.to))&&query(`${r.subject} ${r.body} ${r.sender}`))
  const issues=(records?.issues??[]).filter(r=>(!scoped||projectIds.has(r.projectId))&&(!b.issueStatus||r.status===b.issueStatus)&&query(`${r.title} ${r.description} ${r.owner}`))
  const selectedDate=b.selectedDate??b.dateRange?.from??plan.referenceDate
  const value={...workspace,selectedDate,selectDate:(date:string)=>onChange({selectedDate:date,dateRange:{from:date,to:date}}),updateFilters:(patch:Partial<Filters>)=>onChange({...(patch.status?{taskStatuses:undefined}:{}),...(patch.query===''&&patch.from===''&&patch.to===''?{owner:undefined}:{}),taskFilters:viewBindingsSchema.shape.taskFilters.parse({...b.taskFilters,...patch})}),
    state:{...workspace.state,tasks:selectViewTasks(workspace.state.tasks.filter(t=>linked('task',t.id)),plan),events:selectViewEvents(workspace.state.events.filter(e=>!scoped||records?.meetings.some(m=>projectIds.has(m.projectId)&&m.eventId===e.id)),plan),filters:b.taskFilters,activity:workspace.state.activity.filter(query)} }
  if(b.draftKey?.startsWith('google-preparation:') && (!google?.connection?.accountId || !b.draftKey.startsWith('google-preparation:'+google.connection.accountId+':'))) return <p className="text-sm text-muted-foreground">Connect the original Google Calendar account to view these preparation notes.</p>
  const content=<WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  return <ComponentViewContext.Provider value={{plan,change:onChange,resources,communications,issues,projects,clients:(records?.clients??[]).filter(c=>!b.clientId||c.id===b.clientId)}}>{google?<GoogleCalendarContext.Provider value={{...google,date:selectedDate,setDate:value.selectDate,timezone:plan.timezone}}>{content}</GoogleCalendarContext.Provider>:content}</ComponentViewContext.Provider>
}
