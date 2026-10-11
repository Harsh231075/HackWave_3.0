import { meetingLayoutSchema, usageLayoutSchema, overdueLayoutSchema } from '../services/layoutService.ts'
import { liveRequestSchema } from '../services/liveCalendarLayoutService.ts'
import { z } from 'zod'
import { componentViewSchema } from './componentIntent.ts'
import { widgetTypes } from '../lib/workspace/config.ts'
export const managedItemSchema=z.object({id:z.enum(widgetTypes),span:z.enum(['full','wide','narrow']),plan:componentViewSchema.optional(),meeting:meetingLayoutSchema.optional(),usage:usageLayoutSchema.optional(),overdue:overdueLayoutSchema.optional(),live:liveRequestSchema.optional()})
export const managedWorkspaceSchema=z.array(managedItemSchema).max(15).refine(items=>new Set(items.map(i=>i.id)).size===items.length)
export type ManagedItem=z.infer<typeof managedItemSchema>
const key='orlo-continuous-workspace-v1'
export const managedWorkspaceService={
 load():ManagedItem[]|null{try{const value=managedWorkspaceSchema.safeParse(JSON.parse(localStorage.getItem(key)??'null'));return value.success?value.data:null}catch{return null}},
 save(items:ManagedItem[]){try{localStorage.setItem(key,JSON.stringify(managedWorkspaceSchema.parse(items)))}catch{/* Keep live state if device storage fails. */}},
}

export function updateManagedViews(items:ManagedItem[],view:z.infer<typeof componentViewSchema>,goal:string):ManagedItem[] {
 const next=[...items]
 for(const id of view.widgets){
  const index=next.findIndex(item=>item.id===id),existing=next[index]
  const previous=existing?.plan
  const changes=Object.fromEntries(Object.entries(view.bindings).filter(([key,value])=>key!=='taskFilters'&&value!==undefined))
  const filterChanges=Object.fromEntries(Object.entries(view.bindings.taskFilters).filter(([,value])=>value!==''&&value!=='all'&&value!=='due'))
  const reset=/\b(all tasks|all statuses|reset filters|clear filters|no filters)\b/i.test(goal)
  const bindings=previous?{...previous.bindings,...changes,taskFilters:reset?{...view.bindings.taskFilters}:{...previous.bindings.taskFilters,...filterChanges}}:view.bindings
  if(view.bindings.taskFilters.from&&!view.bindings.taskFilters.to&&/upcoming|onward|from now/i.test(goal)){bindings.taskFilters.to='';delete bindings.dateRange}
  if(filterChanges.status&&!view.bindings.taskStatuses)delete bindings.taskStatuses
  if(/sort.*due|due date order/i.test(goal))bindings.taskFilters.sort='due'
  if(/all priorities|any priority/i.test(goal))bindings.taskFilters.priority='all'
  if(/all owners|everyone/i.test(goal))delete bindings.owner
  if(reset){delete bindings.taskStatuses;delete bindings.owner;delete bindings.dateRange;delete bindings.selectedDate}
  const plan=componentViewSchema.parse({...view,widgets:[id],bindings})
  const item:ManagedItem={...existing,id,span:existing?.span??'full',plan,...(existing?.meeting?{meeting:{...existing.meeting,taskFilters:plan.bindings.taskFilters}}:{}),...(existing?.usage?{usage:{...existing.usage,taskFilters:plan.bindings.taskFilters}}:{}),...(existing?.overdue?{overdue:{...existing.overdue,filters:plan.bindings.taskFilters}}:{})}
  if(index<0)next.push(item);else next[index]=item
 }
 return next
}
