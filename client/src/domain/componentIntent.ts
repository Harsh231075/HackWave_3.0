import { extensionIds } from '../extensions/contracts.ts'
import { capabilityAllowed, isExtension } from '../extensions/catalog.ts'
import { projectHasClient } from './projects.ts'
import { continuationChangeSchema, type IntentChanges } from './intentChanges.ts'
import { taskFiltersSchema, widgetBindingSchema, widgetViewStateSchema } from './widgetInstances.ts'
import { managementSchema, localManagement, destructiveGoal, authorizesClear, namedWidgets, removalNeedsClarification, recordMutationGoal, resourceCreationGoal } from './workspaceManagement.ts'
import { z } from 'zod'
import { widgetTypes } from '../lib/workspace/config.ts'
import { shiftDate } from './calendar.ts'
import { emptyFilters, filterTasks } from './workspace.ts'
import type { Task, Event } from './types.ts'

export const viewBindingsSchema = z.object({
  timerDurationMinutes: z.number().int().min(1).max(180).optional(), selectedTaskId: z.string().optional(),
  taskFilters: taskFiltersSchema.default(emptyFilters),
  taskStatuses: z.array(z.enum(['pending','blocked','completed'])).min(1).max(3).optional(), issueStatus: z.enum(['open','closed']).optional(),
  owner: z.string().max(160).optional(), dateRange: z.object({ from: z.iso.date(), to: z.iso.date() }).optional(),
  selectedDate: z.iso.date().optional(), category: z.enum(['all','meeting','focus','class','break']).optional(),
  taskView: z.enum(['list','kanban']).optional(), calendarView: z.enum(['month','week','day','agenda']).optional(),
  chartType: z.enum(['trend','comparison','allocation']).optional(), resourceQuery: z.string().max(160).optional(),
  recordQuery: z.string().max(160).optional(), projectId: z.string().optional(), clientId: z.string().optional(), draftKey: z.string().optional(),
})
export const componentViewSchema = z.object({
  action: z.literal('view'), widgets: z.array(z.enum(widgetTypes)).min(1).max(widgetTypes.length), bindings: viewBindingsSchema,
  reply: z.string().min(1).max(1000), referenceDate: z.iso.date(), timezone: z.string(), source: z.enum(['ai','local']).optional(), continuation: continuationChangeSchema.optional(),
}).superRefine((view, ctx) => {
  if (new Set(view.widgets).size !== view.widgets.length) ctx.addIssue({ code:'custom',message:'Components must be unique.' })
  if (view.bindings.dateRange && view.bindings.dateRange.from > view.bindings.dateRange.to) ctx.addIssue({ code:'custom',message:'Dates must be ordered.' })
  if (view.bindings.taskFilters.from && view.bindings.taskFilters.to && view.bindings.taskFilters.from > view.bindings.taskFilters.to) ctx.addIssue({ code:'custom',message:'Task dates must be ordered.' })
})
export type ComponentView = z.infer<typeof componentViewSchema>
export type ViewBindings = z.infer<typeof viewBindingsSchema>
export const componentResolutionSchema = z.discriminatedUnion('action', [componentViewSchema, managementSchema,
  z.object({ action:z.literal('clarify'), question:z.string().min(1).max(1000), choices:z.array(z.string().max(4000)).max(6),source:z.enum(['ai','local']).optional() }),
  z.object({ action:z.literal('workflow'), kind:z.enum(['meeting_preparation','meeting_scheduling','usage_investigation','overdue_review']),continuation:continuationChangeSchema.optional(),source:z.enum(['ai','local']).optional() }),
])
export type ComponentResolution = z.infer<typeof componentResolutionSchema>
export const componentRequestSchema = z.object({ enabledExtensions:z.array(z.enum(extensionIds)).default([]), selectedProjectId:z.string().optional(), goal:z.string().trim().min(1).max(4000), referenceDate:z.iso.date(), timezone:z.string().refine(value => {try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}}), lastTargetIds:z.array(z.string()).max(14).optional(), previous:componentViewSchema.optional(), workspaceWidgets:z.array(z.enum(widgetTypes)).max(widgetTypes.length).optional(), componentPlans:z.array(componentViewSchema).max(widgetTypes.length).optional(),
  instances:z.array(z.object({pinned:z.boolean().optional(),instanceId:z.string(),widgetType:z.enum(widgetTypes),binding:widgetBindingSchema,viewState:widgetViewStateSchema})).max(14).optional(),
  catalog:z.object({ tasks:z.array(z.object({id:z.string(),title:z.string(),projectId:z.string().optional()})).default([]), owners:z.array(z.string()).max(1000), projects:z.array(z.object({id:z.string(),name:z.string(),clientId:z.string().optional(),clientIds:z.string().array().optional()})).max(1000), clients:z.array(z.object({id:z.string(),name:z.string()})).max(1000), draftKeys:z.array(z.string()).max(1000), topics:z.array(z.string()).max(1000) }),
})
type ParsedComponentRequest=z.infer<typeof componentRequestSchema>
export type ComponentRequest = Omit<ParsedComponentRequest,'enabledExtensions'|'catalog'> & {enabledExtensions?:ParsedComponentRequest['enabledExtensions'];catalog:Omit<ParsedComponentRequest['catalog'],'tasks'> & {tasks?:ParsedComponentRequest['catalog']['tasks']}}
export function validateComponentResolution(value: unknown, input: ComponentRequest) {
  if (value && typeof value === 'object' && 'action' in value && value.action === 'view' && 'bindings' in value && value.bindings && typeof value.bindings === 'object' && 'taskFilters' in value.bindings && value.bindings.taskFilters && typeof value.bindings.taskFilters === 'object') {
    value = { ...value, bindings: { ...value.bindings, taskFilters: { ...emptyFilters(), ...value.bindings.taskFilters } } }
  }
  const result = componentResolutionSchema.safeParse(value)
  if (!result.success) return result
  const reject=(message:string,path:string[]=[])=>({success:false as const,error:new z.ZodError([{code:'custom',message,path}])})
  if ('continuation' in result.data && result.data.continuation?.targetInstanceIds.some(id => !input.instances?.some(instance => instance.instanceId === id))) return componentResolutionSchema.safeParse(null)
  const additions = result.data.action === 'view' ? result.data.widgets : result.data.action === 'manage' ? result.data.operations.flatMap(op => op.type === 'add' ? op.widgets : op.type === 'replace' ? op.with : []) : []
  if (additions.some(id => !capabilityAllowed(id,input.enabledExtensions))) return reject('Enable this extension in Plugins before adding it.')
  if (result.data.action === 'view' && result.data.widgets.some(isExtension)) {
    const b=result.data.bindings
    if (!b.projectId || !input.catalog.projects.some(p=>p.id===b.projectId)) return reject('Select a project for this extension.')
    if (b.selectedTaskId && !(input.catalog.tasks??[]).some(t=>t.id===b.selectedTaskId && t.projectId===b.projectId)) return reject('Select a task belonging to this project.')
  }
  if (result.data.action === 'manage') {
    if (recordMutationGoal(input.goal)) return reject('Record mutation is not a workspace layout operation.',['operations'])
    if(result.data.operations.some(op=>op.type==='clear')&&!authorizesClear(input.goal))return reject('Clearing the workspace was not explicitly authorized.',['operations'])
    const named=namedWidgets(input.goal)
    for(const op of result.data.operations){if(op.type==='remove'||op.type==='replace'||op.type==='keep'){const targets=op.widgets.map(id=>input.instances?.find(w=>w.instanceId===id)?.widgetType??id);if(named.length&&targets.some(id=>!named.includes(id as typeof widgetTypes[number])))return reject('Removal targets do not match the requested components.',['operations'])}}
    const allowed = new Set<string>([...widgetTypes, ...(input.instances ?? []).map(w => w.instanceId)])
    for (const op of result.data.operations) {
      const targets = op.type === 'clear' || op.type === 'add' ? [] : op.type === 'move' ? [op.widget, ...(op.relativeTo ? [op.relativeTo] : [])] : op.type === 'resize' ? [op.widget] : op.widgets
      if (targets.some(target => !allowed.has(target))) return reject('The model referenced an unknown component or instance.',['operations'])
    }
    if (result.data.operations.some(op=>['clear','keep','remove','replace'].includes(op.type)) && !destructiveGoal(input.goal)) return reject('Component removal was not explicitly authorized.',['operations'])
    return result
  }
  if (result.data.action !== 'view') return result
  const view = result.data, b = view.bindings
  if (view.continuation?.targetInstanceIds.some(id => input.instances?.some(instance => instance.instanceId === id && instance.pinned)) && !/\b(pinned|pin)\b/i.test(input.goal)) return componentResolutionSchema.safeParse(null)
  const localRefinement = fallbackComponentIntent(input)
  if (!view.continuation && localRefinement.action === 'view' && localRefinement.continuation?.relationship === 'refinement') return componentResolutionSchema.safeParse(null)
  if (view.continuation?.targetInstanceIds.some(id => !input.instances?.some(instance => instance.instanceId === id && view.widgets.includes(instance.widgetType)))) return componentResolutionSchema.safeParse(null)
  const changes = view.continuation?.changes
  if (changes?.owner?.operation === 'set' && !input.catalog.owners.includes(changes.owner.value)) return componentResolutionSchema.safeParse(null)
  if (changes?.projectId?.operation === 'set' && !input.catalog.projects.some(p => p.id === (changes.projectId as { value: string }).value)) return componentResolutionSchema.safeParse(null)
  if (changes?.clientId?.operation === 'set' && !input.catalog.clients.some(c => c.id === (changes.clientId as { value: string }).value)) return componentResolutionSchema.safeParse(null)
  if (view.referenceDate !== input.referenceDate) return reject('The model used a different reference date.',['referenceDate'])
  if(view.timezone!==input.timezone)return reject('The model used a different timezone.',['timezone'])
  if(b.projectId&&!input.catalog.projects.some(p=>p.id===b.projectId))return reject('The model selected a project outside the available catalog.',['bindings','projectId'])
  if(b.clientId&&!input.catalog.clients.some(c=>c.id===b.clientId))return reject('The model selected a client outside the available catalog.',['bindings','clientId'])
  if(b.owner&&!input.catalog.owners.includes(b.owner))return reject('The model selected an owner outside the available catalog.',['bindings','owner'])
  if(b.draftKey&&b.draftKey!=='outline'&&!input.catalog.draftKeys.includes(b.draftKey))return reject('The model selected an unavailable draft.',['bindings','draftKey'])
  if(b.projectId&&b.clientId&&!projectHasClient(input.catalog.projects.find(p=>p.id===b.projectId),b.clientId))return reject('The selected project does not belong to the selected client.',['bindings','projectId'])
  // A recognized date must survive model interpretation, including Hinglish “aaj”.
  const local = fallbackComponentIntent(input)
  const explicitStatus = /\b(?:pending|blocked|completed|overdue|unfinished|incomplete)\s+(?:tasks?|work|items?)\b|\b(?:tasks?|items?)\s+(?:that are\s+|which are\s+)?(?:pending|blocked|completed|overdue)\b/i.test(input.goal)
  if (explicitStatus && local.action === 'view' && view.widgets.some(w=>w==='tasks'||w==='metrics')) {
    const expected = local.bindings.taskFilters.status
    const actualStatus = changes?.status?.operation === 'set' ? changes.status.value : changes?.status?.operation === 'clear' ? 'all' : b.taskFilters.status
    const actualStatuses = changes?.taskStatuses?.operation === 'set' ? changes.taskStatuses.value : changes?.taskStatuses?.operation === 'clear' || changes?.status ? undefined : b.taskStatuses
    const equivalent = expected !== 'all' && expected !== 'overdue' && actualStatus === 'all' && actualStatuses?.length === 1 && actualStatuses[0] === expected
    if (actualStatus !== expected && !equivalent) return reject('The model contradicted the requested task status.',['bindings','taskFilters','status'])
    if(local.bindings.taskStatuses && JSON.stringify([...(actualStatuses??[])].sort())!==JSON.stringify([...local.bindings.taskStatuses].sort()))return reject('The model did not preserve the requested task statuses.',['bindings','taskStatuses'])
  }
  if (local.action === 'view' && local.bindings.dateRange) {
    const expected = local.bindings.dateRange
    if ((changes?.dateRange?.operation === 'set' ? changes.dateRange.value : b.dateRange)?.from !== expected.from || (changes?.dateRange?.operation === 'set' ? changes.dateRange.value : b.dateRange)?.to !== expected.to) return reject('The model did not preserve the requested date range.',['bindings','dateRange'])
    if (view.widgets.some(widget => widget === 'tasks' || widget === 'metrics') && b.taskFilters.status !== 'overdue' && changes?.dateRange?.operation !== 'set' && (b.taskFilters.from !== expected.from || b.taskFilters.to !== expected.to)) return reject('Task date filters do not match the requested date range.',['bindings','taskFilters'])
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
  const result = keywordComponentIntent(input)
  const additions=result.action==='view'?result.widgets:result.action==='manage'?result.operations.flatMap(op=>op.type==='add'?op.widgets:op.type==='replace'?op.with:[]):[]
  if(additions.some(id=>!capabilityAllowed(id,input.enabledExtensions)))return {action:'clarify',source:'local',question:'Enable the requested extension in Plugins first.',choices:[]}
  const text = input.goal.toLowerCase()
  const isRefinement = /^(only|just|sirf|same|show only)\b|\b(instead|too|again|all owners|all priorities|all statuses|all overdue tasks|reset filters|clear filters)\b/.test(text)
  if (!isRefinement) return { ...result, source: 'local', ...(result.action === 'view' || result.action === 'workflow' ? { continuation: { relationship: 'new_goal' as const, targetInstanceIds: [], changes: {} } } : {}) }
  const changes: IntentChanges = {}
  const set = (field: keyof IntentChanges, value: unknown) => Object.assign(changes, { [field]: { operation: 'set', value } })
  const clear = (field: keyof IntentChanges) => Object.assign(changes, { [field]: { operation: 'clear' } })
  if (/blocked/.test(text)) set('status', 'blocked')
  else if (/pending/.test(text)) set('status', 'pending')
  else if (/completed/.test(text)) set('status', 'completed')
  else if (/all statuses|all overdue tasks/.test(text)) { clear('status'); clear('taskStatuses') }
  for (const priority of ['urgent','high','medium','low']) if (new RegExp('\\b'+priority+'\\b').test(text)) set('priority', priority)
  if (/all priorities|any priority/.test(text)) clear('priority')
  if (/all owners|everyone/.test(text)) clear('owner')
  if (/reset filters|clear filters/.test(text)) for (const key of ['status','taskStatuses','priority','owner','query','from','to'] as const) clear(key)
  if (result.action === 'view') {
    const bindings = result.bindings
    if (/today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}|this week|next week/.test(text) && bindings.dateRange) set('dateRange', bindings.dateRange)
    if (/kanban|list/.test(text) && bindings.taskView) set('taskView', bindings.taskView)
    if (bindings.owner && input.catalog.owners.some(owner => text.includes(owner.toLowerCase()))) set('owner', bindings.owner)
    if (bindings.projectId && input.catalog.projects.some(p => text.includes(p.name.toLowerCase()))) set('projectId', bindings.projectId)
    if (bindings.clientId && !changes.projectId && input.catalog.clients.some(c => text.includes(c.name.toLowerCase()))) set('clientId', bindings.clientId)
  }
  if (!Object.keys(changes).length) return { action: 'clarify', source: 'local', question: 'I could not resolve this refinement. Specify the view and the change you want.', choices: [] }
  const parsed = continuationChangeSchema.safeParse({ relationship: 'refinement', targetInstanceIds: [], changes })
  if (!parsed.success) return { action: 'clarify', source: 'local', question: 'Choose a valid refinement.', choices: [] }
  if (result.action === 'view') return { ...result, widgets: input.previous?.widgets ?? result.widgets, continuation: parsed.data, source: 'local' }
  return { action: 'clarify', source: 'local', question: 'Specify the view to refine.', choices: [] }
}
function keywordComponentIntent(input: ComponentRequest): ComponentResolution {
  if(removalNeedsClarification(input.goal))return {action:'clarify',question:'Your wording does not explicitly authorize removing components. Describe the change you want, for example “remove the suggestions card”.',choices:['Show my tasks','Show my calendar']}
  if (!destructiveGoal(input.goal) && resourceCreationGoal(input.goal)) return componentViewSchema.parse({action:'view',widgets:['resource-create'],bindings:{},reply:'Fill in the resource details and save it when ready.',referenceDate:input.referenceDate,timezone:input.timezone})
  const management=localManagement(input.goal);if(management && !(management.operations.length===1 && management.operations[0].type==='add' && management.operations[0].widgets.length===1 && isExtension(management.operations[0].widgets[0])))return management
  if (recordMutationGoal(input.goal)) return { action: 'clarify', question: 'Do you want to remove a component or change a record? Use “remove the tasks widget” for layout changes; edit records through their controls.', choices: ['Show my tasks', 'Show my meetings', 'Show my calendar'] }
  const text = input.goal.toLowerCase().replace(/[’']/g,'').trim()
  const extension = /voice note|audio note|recording/.test(text) ? 'voice-note' : /timer|pomodoro|(?:focus|work).*\d+\s*(?:min|minute)/.test(text) ? 'quick-timer' : undefined
  if(extension){
    const project=input.catalog.projects.find(p=>text.includes(p.name.toLowerCase()))??input.catalog.projects.find(p=>p.id===(input.selectedProjectId??input.previous?.bindings.projectId))??(input.catalog.projects.length===1?input.catalog.projects[0]:undefined)
    if(!project)return {action:'clarify',question:'Choose a project for this extension.',choices:input.catalog.projects.slice(0,6).map(p=>`Show ${extension} for ${p.name}`)}
    const minutes=text.match(/(\d+)\s*(?:min|minute)/)?.[1]
    return componentViewSchema.parse({action:'view',widgets:[extension],bindings:{projectId:project.id,...(minutes?{timerDurationMinutes:Number(minutes)}:{}),selectedTaskId:input.catalog.tasks?.find(task=>task.projectId===project.id&&text.includes(task.title.toLowerCase()))?.id},reply:'Ready when you are.',referenceDate:input.referenceDate,timezone:input.timezone})
  }
  const clarification = (question:string): ComponentResolution => ({action:'clarify',question,choices:['Show my tasks','Show today’s overview','Show my calendar','Show my meetings']})
  if (/\b(schedule|arrange|book|create|set up)\b/.test(text) && /meeting|appointment|call/.test(text)) return {action:'workflow',kind:'meeting_scheduling'}
  if (/prepar|\bprep\b|agenda|brief/.test(text) && /meeting|call|मीटिंग|बैठक/.test(text)) return {action:'workflow',kind:'meeting_preparation'}
  if (/investigat|usage drop|retention drop/.test(text)) return {action:'workflow',kind:'usage_investigation'}
  if (/overdue|recovery/.test(text) && /project|rebalance|reassign/.test(text)) return {action:'workflow',kind:'overdue_review'}
  const bindings: ViewBindings = {taskFilters:viewBindingsSchema.shape.taskFilters.parse(emptyFilters())}
  const widgets: ComponentView['widgets'] = []
  const add=(id: ComponentView['widgets'][number])=>{if(!widgets.includes(id))widgets.push(id)}
  if (/overview|dashboard|my day|mera din|aaj ka din|आज का|day look|daily summary/.test(text)) ['metrics','tasks','timeline','meetings'].forEach(id=>add(id as ComponentView['widgets'][number]))
  if (/deadlines?|tasks?|to[ -]?do|pending|unfinished|incomplete|left to do|whats left|remaining work|work items?|kaam|काम|कार्य|लंबित|अधूर|बाकी/.test(text)) add('tasks')
  if (/calendar|calender|schedule grid|कैलेंडर/.test(text)) add('calendar')
  if (/meetings?|appointments?|calls?|बैठक|मीटिंग/.test(text)) add('meetings')
  if (/timeline|time.?block|schedule|planner|दिनचर्या/.test(text) && !/schedule grid/.test(text)) add('timeline')
  if (/availab|free slots?|free time|khali time|खाली समय/.test(text)) add('availability')
  if (/recommend|suggest|next step|what.*focus|prioriti[sz]e/.test(text)) add('recommendation')
  if (/notes?|outline|draft|talking points|नोट्स/.test(text)) add('outline')
  if (/resources?|documents?|reference|materials?|दस्तावेज/.test(text)) add('resources')
  if (/context|project background|project summary/.test(text)) add('context')
  if (/metrics?|stats|statistics|how many|counts?|kpis|(?<!project )summary/.test(text) && (!/resources|documents/.test(text) || /\bmetrics?\b|\bkpis?\b/.test(text))) add('metrics')
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
