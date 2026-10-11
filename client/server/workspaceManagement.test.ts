import test from 'node:test'
import assert from 'node:assert/strict'
import {localManagement} from '../src/domain/workspaceManagement.ts'
import { applyComponentView } from '../src/domain/instanceViews.ts'
import { applyInstanceOperations, emptyWorkspace, workspaceDocumentSchema } from '../src/domain/workspaceDocument.ts'
import { makeInstance } from '../src/services/workspaceDocumentService.ts'
import type { WidgetInstance } from '../src/domain/widgetInstances.ts'
const updateViews = (items: WidgetInstance[], plan: ReturnType<typeof view>, goal: string) => applyComponentView({ ...emptyWorkspace(), active: items }, plan, goal).active
const instanceCollectionSchema = { safeParse: (items: WidgetInstance[]) => workspaceDocumentSchema.safeParse({ ...emptyWorkspace(), active: items }), parse: (items: WidgetInstance[]) => workspaceDocumentSchema.parse({ ...emptyWorkspace(), active: items }).active }
import {fallbackComponentIntent,validateComponentResolution,type ComponentRequest} from '../src/domain/componentIntent.ts'
const request:ComponentRequest={goal:'Show today’s overview',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:['Alex'],projects:[],clients:[],draftKeys:[],topics:[]}}
function view(goal:string){const result=fallbackComponentIntent({...request,goal});assert.equal(result.action,'view');if(result.action!=='view')throw new Error(goal);return result}
const create=(id:WidgetInstance['widgetType']):WidgetInstance=>makeInstance(id)
const manage=(items:WidgetInstance[],goal:string)=>{const command=localManagement(goal);assert.ok(command,goal);return applyInstanceOperations({ ...emptyWorkspace(), active: items },command.operations,create).active}
const ids=(items:WidgetInstance[])=>items.map(item=>item.widgetType)
test('new topics add to existing workspace without losing scoped records',()=>{
 let items=updateViews([],view('Show today’s overview'),request.goal)
 const tasks=items.find(item=>item.widgetType==='tasks')!
 items=updateViews(items,view('Add a suggestions card'),'Add a suggestions card')
 items=updateViews(items,view('Show tomorrow’s meetings'),'Show tomorrow’s meetings')
 assert.deepEqual(ids(items),['metrics','tasks','timeline','meetings','recommendation'])
 assert.deepEqual(items.find(item=>item.widgetType==='tasks'),tasks)
 assert.equal(tasks.viewState.taskFilters.from,'2026-10-11')
 assert.equal(items.find(item=>item.widgetType==='meetings')!.viewState.dateRange!.from,'2026-10-12')
})
test('remove all allows zero components and additions after clear start empty',()=>{
 const empty=manage([create('tasks'),create('meetings')],'Remove all')
 assert.deepEqual(empty,[])
 assert.deepEqual(ids(updateViews(empty,view('Show my meetings'),'Show my meetings')),['meetings'])
 assert.equal(instanceCollectionSchema.safeParse(empty).success,true)
})
test('keep-only preserves the original meeting instance and its bindings',()=>{
 const meeting=updateViews([],view('Tomorrow’s meetings'),'Tomorrow’s meetings')[0]
 assert.deepEqual(manage([create('tasks'),meeting,create('metrics')],'Remove all except meetings'),[meeting])
})
for(const goal of ['Remove all and show me my meetings','Clear everything then add meetings'])test(goal,()=>assert.deepEqual(ids(manage([create('calendar'),create('tasks')],goal)),['meetings']))
test('combined keep and add deadlines retains only requested existing components',()=>assert.deepEqual(ids(manage([create('meetings'),create('metrics'),create('outline')],'Remove everything except meetings and add my upcoming deadlines')),['meetings','tasks']))
test('combined specific removal and addition does not remove the addition',()=>assert.deepEqual(ids(manage([create('recommendation'),create('calendar')],'Remove suggestions and add tasks')),['calendar','tasks']))
test('move retains item identity and unrelated order',()=>{
 const items=[create('metrics'),create('tasks'),create('timeline'),create('meetings'),create('recommendation')]
 const next=manage(items,'Move suggestions above the overview')
 assert.deepEqual(ids(next),['recommendation','metrics','tasks','timeline','meetings'])
 assert.deepEqual(next[0],items[4]);assert.deepEqual(next[2],items[1])
 assert.deepEqual(ids(manage(next,'Remove the suggestions card')),['metrics','tasks','timeline','meetings'])
})
test('specific replacement preserves unrelated components',()=>assert.deepEqual(ids(manage([create('tasks'),create('meetings')],'Replace tasks with calendar')),['calendar','meetings']))
test('only high priority modifies task filters rather than removing other components',()=>{
 const first=updateViews([],view('Today’s pending tasks'),"Today’s pending tasks")
 const items=[...first,create('calendar')]
 const next=updateViews(items,view('Only high priority tasks'),'Only high priority tasks')
 assert.deepEqual(ids(next),['tasks','calendar']);assert.deepEqual(next[1],items[1])
 assert.equal(next[0].viewState.taskFilters.status,'pending');assert.equal(next[0].viewState.taskFilters.from,'2026-10-11');assert.equal(next[0].viewState.taskFilters.priority,'high')
})
test('resize retains other item references',()=>{const items=[create('calendar'),create('tasks')];const next=manage(items,'Make calendar narrow');assert.equal(next[0].span,'narrow');assert.deepEqual(next[1],items[1])})
test('invalid target operations fail atomically without changing original items',()=>{const items=[create('tasks')];assert.throws(()=>manage(items,'Move tasks above calendar'));assert.deepEqual(ids(items),['tasks']);assert.throws(()=>manage(items,'Replace calendar with notes'))})
test('AI cannot clear components for a new topic or negated removal',()=>{
 const clear={action:'manage',operations:[{type:'clear'}],reply:'Cleared'}
 for(const goal of ['Show meetings','Only high priority','Do not remove all'])assert.equal(validateComponentResolution(clear,{...request,goal}).success,false)
 assert.equal(localManagement('Do not remove all'),null)
})
test('existing settings survive ordinary show requests and explicit filter reset changes only target',()=>{
 let items=updateViews([],view('Alex high priority pending tasks today'),'Alex high priority pending tasks today')
 items=updateViews(items,view('Show tasks'),'Show tasks')
 assert.equal(items[0].viewState.owner,'Alex');assert.equal(items[0].viewState.taskFilters.priority,'high')
 const calendar=create('calendar');items.push(calendar)
 items=updateViews(items,view('Show all tasks'),'Show all tasks')
 assert.equal(items[0].viewState.taskFilters.status,'all');assert.equal(items[0].viewState.taskFilters.from,'');assert.equal(items[0].viewState.owner,undefined);assert.deepEqual(items[1],calendar)
})
test('canonical workspace persists typed component scope, order and bindings',()=>{
 const items=updateViews([create('calendar')],view('Today’s pending tasks'),'Today’s pending tasks')
 assert.deepEqual(instanceCollectionSchema.parse(JSON.parse(JSON.stringify(items))),items)
 const repeated=create('tasks');assert.equal(instanceCollectionSchema.safeParse([repeated,repeated]).success,false)
})

test('upcoming deadlines means incomplete tasks due today or later',()=>{const result=view('Show upcoming deadlines');assert.equal(result.bindings.taskFilters.from,request.referenceDate);assert.equal(result.bindings.taskFilters.status,'all');assert.deepEqual(result.bindings.taskStatuses,['pending','blocked'])})

test('upcoming deadlines drop an old upper bound without affecting meetings',()=>{const items=updateViews([],view('Tasks for 2026-10-01'), 'Tasks for 2026-10-01');const meeting=create('meetings');items.push(meeting);const next=updateViews(items,view('Upcoming deadlines'),'Upcoming deadlines');assert.equal(next[0].viewState.taskFilters.from,'2026-10-11');assert.equal(next[0].viewState.taskFilters.to,'');assert.deepEqual(next[1],meeting)})

test('record deletion wording cannot remove a widget',()=>{
 for(const goal of ['Delete task-3','Remove the meeting','Delete an event']){
  assert.equal(localManagement(goal),null)
  assert.equal(fallbackComponentIntent({...request,goal}).action,'clarify')
  assert.equal(validateComponentResolution({action:'manage',operations:[{type:'remove',widgets:['tasks']}],reply:'Removed'},{...request,goal}).success,false)
 }
 assert.ok(localManagement('Remove the tasks widget'))
})
