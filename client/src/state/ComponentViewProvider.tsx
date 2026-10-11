import { useContext, type ReactNode } from 'react'
import { WorkspaceContext } from './WorkspaceProvider'
import { GoogleCalendarContext } from './GoogleCalendarContext'
import { ComponentViewContext } from './ComponentViewContext'
import { selectViewTasks, selectViewEvents, viewBindingsSchema, type ComponentView, type ViewBindings } from '@/domain/componentIntent'
import type { Filters } from '@/domain/types'
import { adaptiveDataService, resourceService, eventService } from '@/services'
export function ComponentViewProvider({plan,onChange,children}:{plan:ComponentView;onChange:(bindings:Partial<ViewBindings>)=>void;children:ReactNode}) {
  const workspace=useContext(WorkspaceContext)
  const google=useContext(GoogleCalendarContext)
  if(!workspace)throw new Error('Component views require workspace records.')
  const records=adaptiveDataService.snapshot()
  const b=plan.bindings
  const query=(value:string)=>!b.recordQuery||value.toLowerCase().includes(b.recordQuery.toLowerCase())
  const resources=resourceService.list().filter(r=>(!b.resourceQuery||`${r.title} ${r.context} ${r.body}`.toLowerCase().includes(b.resourceQuery.toLowerCase())))
  const communications=(records?.communications??[]).filter(r=>(!b.dateRange||(r.date>=b.dateRange.from&&r.date<=b.dateRange.to))&&query(`${r.subject} ${r.body} ${r.sender}`))
  const issues=(records?.issues??[]).filter(r=>(!b.issueStatus||r.status===b.issueStatus)&&query(`${r.title} ${r.description} ${r.owner}`))
  const selectedDate=b.selectedDate??b.dateRange?.from??plan.referenceDate
  const value={...workspace,selectedDate,selectDate:(date:string)=>onChange({selectedDate:date,dateRange:{from:date,to:date}}),updateFilters:(patch:Partial<Filters>)=>onChange({...(patch.status?{taskStatuses:undefined}:{}),...(patch.query===''&&patch.from===''&&patch.to===''?{owner:undefined}:{}),taskFilters:viewBindingsSchema.shape.taskFilters.parse({...b.taskFilters,...patch})}),
    state:{...workspace.state,tasks:selectViewTasks(workspace.state.tasks,plan),events:selectViewEvents(workspace.state.events.map(event => eventService.getById(event.id) ?? event),plan),filters:b.taskFilters,activity:workspace.state.activity.filter(query)} }
  if(b.draftKey?.startsWith('google-preparation:') && (!google?.connection?.accountId || !b.draftKey.startsWith('google-preparation:'+google.connection.accountId+':'))) return <p className="text-sm text-muted-foreground">Connect the original Google Calendar account to view these preparation notes.</p>
  const content=<WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  return <ComponentViewContext.Provider value={{plan,change:onChange,resources,communications,issues}}>{google?<GoogleCalendarContext.Provider value={{...google,date:selectedDate,setDate:value.selectDate,timezone:plan.timezone}}>{content}</GoogleCalendarContext.Provider>:content}</ComponentViewContext.Provider>
}
