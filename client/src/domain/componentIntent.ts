import { taskFiltersSchema, widgetBindingSchema, widgetViewStateSchema } from './widgetInstances.ts'
import { managementSchema, localManagement, destructiveGoal, recordMutationGoal } from './workspaceManagement.ts'
import { z } from 'zod'
import { widgetTypes } from '../lib/workspace/config.ts'
import { shiftDate } from './calendar.ts'
import { emptyFilters, filterTasks } from './workspace.ts'
import type { Task, Event } from './types.ts'

export const viewBindingsSchema = z.object({
  taskFilters: taskFiltersSchema.default(emptyFilters),
  taskStatuses: z.array(z.enum(['pending','blocked','completed'])).min(1).max(3).optional(), issueStatus: z.enum(['open','closed']).optional(),
  owner: z.string().max(160).optional(), dateRange: z.object({ from: z.iso.date(), to: z.iso.date() }).optional(),
  selectedDate: z.iso.date().optional(), category: z.enum(['all','meeting','focus','class','break']).optional(),
  taskView: z.enum(['list','kanban']).optional(), calendarView: z.enum(['month','week','day','agenda']).optional(),
  chartType: z.enum(['trend','comparison','allocation']).optional(), resourceQuery: z.string().max(160).optional(),
  recordQuery: z.string().max(160).optional(), projectId: z.string().optional(), clientId: z.string().optional(), draftKey: z.string().optional(),
})
export const componentViewSchema = z.object({
  action: z.literal('view'), widgets: z.array(z.enum(widgetTypes)).min(1).max(15), bindings: viewBindingsSchema,
  reply: z.string().min(1).max(1000), referenceDate: z.iso.date(), timezone: z.string(), source: z.enum(['ai','local']).optional(),
}).superRefine((view, ctx) => {
  if (new Set(view.widgets).size !== view.widgets.length) ctx.addIssue({ code:'custom',message:'Components must be unique.' })
  if (view.bindings.dateRange && view.bindings.dateRange.from > view.bindings.dateRange.to) ctx.addIssue({ code:'custom',message:'Dates must be ordered.' })
  if (view.bindings.taskFilters.from && view.bindings.taskFilters.to && view.bindings.taskFilters.from > view.bindings.taskFilters.to) ctx.addIssue({ code:'custom',message:'Task dates must be ordered.' })
})
export type ComponentView = z.infer<typeof componentViewSchema>
export type ViewBindings = z.infer<typeof viewBindingsSchema>
export const componentResolutionSchema = z.discriminatedUnion('action', [componentViewSchema, managementSchema,
  z.object({ action:z.literal('clarify'), question:z.string().min(1).max(1000), choices:z.array(z.string().max(4000)).max(6) }),
  z.object({ action:z.literal('workflow'), kind:z.enum(['meeting_preparation','meeting_scheduling','usage_investigation','overdue_review']) }),
])
export type ComponentResolution = z.infer<typeof componentResolutionSchema>
export const componentRequestSchema = z.object({ goal:z.string().trim().min(1).max(4000), referenceDate:z.iso.date(), timezone:z.string().refine(value => {try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}}), previous:componentViewSchema.optional(), workspaceWidgets:z.array(z.enum(widgetTypes)).max(15).optional(), componentPlans:z.array(componentViewSchema).max(15).optional(),
  instances:z.array(z.object({instanceId:z.string(),widgetType:z.enum(widgetTypes),binding:widgetBindingSchema,viewState:widgetViewStateSchema})).max(14).optional(),
  catalog:z.object({ owners:z.array(z.string()).max(1000), projects:z.array(z.object({id:z.string(),name:z.string(),clientId:z.string().optional()})).max(1000), clients:z.array(z.object({id:z.string(),name:z.string()})).max(1000), draftKeys:z.array(z.string()).max(1000), topics:z.array(z.string()).max(1000) }),
})
export type ComponentRequest = z.infer<typeof componentRequestSchema>
export function validateComponentResolution(value: unknown, input: ComponentRequest) {
  if (value && typeof value === 'object' && 'action' in value && value.action === 'view' && 'bindings' in value && value.bindings && typeof value.bindings === 'object' && 'taskFilters' in value.bindings && value.bindings.taskFilters && typeof value.bindings.taskFilters === 'object') {
    value = { ...value, bindings: { ...value.bindings, taskFilters: { ...emptyFilters(), ...value.bindings.taskFilters } } }
  }
  const result = componentResolutionSchema.safeParse(value)
  if (!result.success) return result
  if (result.data.action === 'manage') {
    if (recordMutationGoal(input.goal)) return componentResolutionSchema.safeParse(null)
    const allowed = new Set<string>([...widgetTypes, ...(input.instances ?? []).map(w => w.instanceId)])
    for (const op of result.data.operations) {
      const targets = op.type === 'clear' || op.type === 'add' ? [] : op.type === 'move' ? [op.widget, ...(op.relativeTo ? [op.relativeTo] : [])] : op.type === 'resize' ? [op.widget] : op.widgets
      if (targets.some(target => !allowed.has(target))) return componentResolutionSchema.safeParse(null)
    }
    if (result.data.operations.some(op=>['clear','keep','remove','replace'].includes(op.type)) && !destructiveGoal(input.goal)) return componentResolutionSchema.safeParse(null)
    return result
  }
  if (result.data.action !== 'view') return result
  const view = result.data, b = view.bindings
  if (view.referenceDate !== input.referenceDate || view.timezone !== input.timezone) return componentResolutionSchema.safeParse(null)
  if ((b.projectId && !input.catalog.projects.some(p=>p.id===b.projectId)) || (b.clientId && !input.catalog.clients.some(c=>c.id===b.clientId)) || (b.owner && !input.catalog.owners.includes(b.owner)) || (b.draftKey && b.draftKey !== 'outline' && !input.catalog.draftKeys.includes(b.draftKey))) return componentResolutionSchema.safeParse(null)
  if (b.projectId && b.clientId && input.catalog.projects.find(p=>p.id===b.projectId)?.clientId !== b.clientId) return componentResolutionSchema.safeParse(null)
  // A recognized date must survive model interpretation, including Hinglish “aaj”.
  const local = fallbackComponentIntent(input)
  if (local.action === 'view' && local.bindings.dateRange) {
    const expected = local.bindings.dateRange
    if (b.dateRange?.from !== expected.from || b.dateRange?.to !== expected.to) return componentResolutionSchema.safeParse(null)
    if (view.widgets.some(widget => widget === 'tasks' || widget === 'metrics') && b.taskFilters.status !== 'overdue' && (b.taskFilters.from !== expected.from || b.taskFilters.to !== expected.to)) return componentResolutionSchema.safeParse(null)
  }
  return result
}
export function selectViewTasks(tasks: Task[], view: ComponentView) {
  return filterTasks(tasks, view.bindings.taskFilters, view.referenceDate).filter(task => (!view.bindings.owner || task.owner === view.bindings.owner)&&(!view.bindings.taskStatuses||view.bindings.taskStatuses.includes(task.status)))
}
export function selectViewEvents(events: Event[], view: ComponentView) {
  const b = view.bindings
  return events.filter(e=>(!b.dateRange || (e.date>=b.dateRange.from && e.date<=b.dateRange.to)) && (!b.category || b.category==='all' || e.category===b.category))
}
const componentTitles: Partial<Record<typeof widgetTypes[number],string>> = {tasks:'Tasks',metrics:'Summary',outline:'Notes',chart:'Productivity',context:'Project context',recommendation:'Suggestions'}
export function fallbackComponentIntent(input: ComponentRequest): ComponentResolution {
  const management=localManagement(input.goal);if(management)return management
  if (recordMutationGoal(input.goal)) return { action: 'clarify', question: 'Do you want to remove a component or change a record? Use “remove the tasks widget” for layout changes; edit records through their controls.', choices: ['Show my tasks', 'Show my meetings', 'Show my calendar'] }
  const text = input.goal.toLowerCase().replace(/[’']/g,'').trim()
  const clarification = (question:string): ComponentResolution => ({action:'clarify',question,choices:['Show my tasks','Show today’s overview','Show my calendar','Show my meetings']})
  if (/\b(schedule|arrange|book|create|set up)\b/.test(text) && /meeting|appointment|call/.test(text)) return {action:'workflow',kind:'meeting_scheduling'}
  if (/prepar|\bprep\b|agenda|brief/.test(text) && /meeting|call|मीटिंग|बैठक/.test(text)) return {action:'workflow',kind:'meeting_preparation'}
  if (/investigat|usage drop|retention drop/.test(text)) return {action:'workflow',kind:'usage_investigation'}
  if (/overdue|recovery/.test(text) && /project|rebalance|reassign/.test(text)) return {action:'workflow',kind:'overdue_review'}
  const bindings: ViewBindings = {taskFilters:viewBindingsSchema.shape.taskFilters.parse(emptyFilters())}
  const widgets: ComponentView['widgets'] = []
  const add=(id: ComponentView['widgets'][number])=>{if(!widgets.includes(id))widgets.push(id)}
  if (/overview|dashboard|my day|mera din|aaj ka din|आज का|day look|daily summary/.test(text)) ['metrics','tasks','timeline','meetings'].forEach(id=>add(id as ComponentView['widgets'][number]))
  if (/deadlines?|tasks?|to[ -]?do|pending|unfinished|incomplete|left to do|whats left|remaining work|kaam|काम|कार्य|लंबित|अधूर|बाकी/.test(text)) add('tasks')
  if (/calendar|calender|कैलेंडर/.test(text)) add('calendar')
  if (/meetings?|appointments?|calls?|बैठक|मीटिंग/.test(text)) add('meetings')
  if (/timeline|time.?block|schedule|planner|दिनचर्या/.test(text)) add('timeline')
  if (/availab|free slots?|free time|खाली समय/.test(text)) add('availability')
  if (/recommend|suggest|next step|what.*focus|prioriti[sz]e/.test(text)) add('recommendation')
  if (/notes?|outline|draft|talking points|नोट्स/.test(text)) add('outline')
  if (/resources?|documents?|reference|materials?|दस्तावेज/.test(text)) add('resources')
  if (/context|project background|project summary/.test(text)) add('context')
  if (/metrics?|stats|statistics|how many|counts?|kpis/.test(text) && !/resources|documents/.test(text)) add('metrics')
  if (/productiv|progress|trend|chart|time allocation|time.*spent/.test(text)) add('chart')
  if (/activity|recent changes|what.*changed|log/.test(text)) add('activity')
  if (/usage|sessions|cohorts?/.test(text)) add('usage')
  if (/communications?|messages?|emails?/.test(text)) add('communications')
  if (/issues?|risks?/.test(text)) add('issues')
  if (/overdue|late tasks|missed deadlines/.test(text)) {add('tasks');bindings.taskFilters.status='overdue'}
  else if (/not.*complet|incomplet|unfinished|remaining|left to do|whats left|open tasks|adhur|baki|बाकी|अधूर/.test(text)) { bindings.taskFilters.status='all'; bindings.taskStatuses=['pending','blocked'] }
  else if (/pending|लंबित/.test(text)) bindings.taskFilters.status='pending'
  else if (/blocked|blockers?|stuck|अवरुद्ध/.test(text)) {add('tasks');bindings.taskFilters.status='blocked'}
  else if (/complet|finished|done tasks|poore|पूरे/.test(text)) bindings.taskFilters.status='completed'
  for(const priority of ['urgent','high','medium','low'] as const) if(new RegExp(`\\b${priority}\\b`).test(text)){bindings.taskFilters.priority=priority;if(!widgets.length)add('tasks')}
  if (/priorit|important|urgent|जरूरी/.test(text)) {bindings.taskFilters.sort='priority';if(!widgets.length)add('tasks')}
  if (/pending/.test(text)&&/completed/.test(text)&&!/not completed/.test(text)){bindings.taskFilters.status='all';bindings.taskStatuses=['pending','completed']}
  if(widgets.includes('metrics')&&/how many|count|number of/.test(text)&&!/list|and tasks|task list/.test(text)){const index=widgets.indexOf('tasks');if(index>=0)widgets.splice(index,1)}
  if (/kanban|board/.test(text)) {add('tasks');bindings.taskView='kanban'}
  if (/time allocation|time.*spent/.test(text)) bindings.chartType='allocation'
  else if (/compar|completed.*pending/.test(text)) bindings.chartType='comparison'
  if (/week view/.test(text)) bindings.calendarView='week';else if(/month view/.test(text))bindings.calendarView='month';else if(/agenda view/.test(text))bindings.calendarView='agenda';else if(/day view/.test(text))bindings.calendarView='day'
  let from='',to=''
  const explicit=[...text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)].map(m=>m[0])
  if(explicit.length){from=explicit[0];to=explicit[1]??from}
  else if(/today|aaj|आज/.test(text)){from=to=input.referenceDate}
  else if(/tomorrow|कल की|कल के/.test(text)){from=to=shiftDate(input.referenceDate,1)}
  else if(/yesterday|बीते कल/.test(text)){from=to=shiftDate(input.referenceDate,-1)}
  else if(/this week|is hafte|इस हफ्ते/.test(text)){const day=new Date(input.referenceDate+'T12:00:00Z').getUTCDay();from=shiftDate(input.referenceDate,-((day+6)%7));to=shiftDate(from,6)}
  else if(/next week/.test(text)){const day=new Date(input.referenceDate+'T12:00:00Z').getUTCDay();from=shiftDate(input.referenceDate,7-((day+6)%7));to=shiftDate(from,6)}
  else if(/\bkal\b|कल/.test(text)) return clarification('By “kal”, do you mean tomorrow or yesterday? Include the date or say tomorrow/yesterday.')
  if(from){if(!z.iso.date().safeParse(from).success||!z.iso.date().safeParse(to).success||from>to)return clarification('Choose valid dates in order, for example 2026-10-11 through 2026-10-17.');bindings.dateRange={from,to};bindings.selectedDate=from;if(bindings.taskFilters.status!=='overdue'){bindings.taskFilters.from=from;bindings.taskFilters.to=to}}
  if (bindings.taskFilters.status==='overdue' && /tomorrow/.test(text)) return clarification('Do you mean work that is already overdue, or work due tomorrow? Say “already overdue tasks” or “tasks due tomorrow”.')
  if(/upcoming deadlines?/.test(text)){bindings.taskFilters.from=input.referenceDate;{ bindings.taskFilters.status='all'; bindings.taskStatuses=['pending','blocked'] }}
  const matchedOwners=input.catalog.owners.filter(owner=>text.includes(owner.toLowerCase()))
  if(matchedOwners.length===1)bindings.owner=matchedOwners[0]
  else if(matchedOwners.length>1)return clarification('Which owner’s tasks should I show? Specify one owner or ask for all tasks.')
  const project=input.catalog.projects.filter(p=>text.includes(p.name.toLowerCase())); if(project.length>1)return clarification('Which project do you mean? Include one project name.');if(project.length===1){bindings.projectId=project[0].id;bindings.clientId=project[0].clientId}
  const client=input.catalog.clients.filter(c=>text.includes(c.name.toLowerCase()));if(client.length===1)bindings.clientId=client[0].id
  if(/focus|deep work/.test(text))bindings.category='focus';else if(widgets.length===1&&widgets[0]==='meetings')bindings.category='meeting'
  const topic=input.catalog.topics.find(topic=>text.includes(topic.toLowerCase()));if(topic)bindings.resourceQuery=topic
  if(input.previous && (/^(only|just|sirf)\b/.test(text)||(!widgets.length&&/tomorrow|today|same|those|them|aaj/.test(text)))) {
    if(!widgets.length)widgets.push(...input.previous.widgets)
    const changes=Object.fromEntries(Object.entries(bindings.taskFilters).filter(([key,value])=>value!==emptyFilters()[key as keyof ReturnType<typeof emptyFilters>]))
    const overrides={...bindings}
    Object.assign(bindings,input.previous.bindings,overrides)
    bindings.taskFilters={...input.previous.bindings.taskFilters,...changes}
  }
  if(widgets.includes('issues'))bindings.issueStatus=/closed issues|resolved issues/.test(text)?'closed':/open issues|unresolved/.test(text)?'open':undefined
  if(widgets.includes('activity')&&from)return clarification('Activity records do not have saved timestamps. Ask for the current activity log instead.')
  const unknownOwner=text.match(/(?:tasks?|work)\s+for\s+([a-z]+)/)?.[1]??text.match(/([a-z]+)\s+ke\s+(?:tasks|kaam)/)?.[1]
  if(unknownOwner&&!['today','tomorrow','this','next','me','mere','all'].includes(unknownOwner)&&!matchedOwners.length&&!project.length&&!client.length)return clarification('That owner or project is not in the available records. Specify a known owner/project, or ask for all tasks.')
  if(!widgets.length)return clarification('What would you like to see? I can show tasks, overview, calendar, meetings, timeline, availability, notes, resources, metrics, productivity, activity, usage, communications or issues.')
  return componentViewSchema.parse({action:'view',widgets,bindings,reply:`Showing ${widgets.map(widget=>(componentTitles[widget]??widget[0].toUpperCase()+widget.slice(1))).join(', ')}${from?` for ${from}${to!==from?' through '+to:''}`:''}${bindings.taskFilters.status!=='all'?' · '+bindings.taskFilters.status+' tasks':''}.`,referenceDate:input.referenceDate,timezone:input.timezone,source:'local'})
}
