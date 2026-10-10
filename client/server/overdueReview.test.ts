import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createOverdueReviewService } from '../src/services/overdueReviewService.ts'
import { createFocusSchedulingService } from '../src/services/focusSchedulingService.ts'
import { createTaskService } from '../src/services/taskService.ts'
import { createLayoutService } from '../src/services/layoutService.ts'
import { ADAPTIVE_DEMO } from '../src/data/adaptiveDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES, DEMO_DATE } from '../src/data/demo.ts'
import { emptyFilters, filterTasks } from '../src/domain/workspace.ts'
import { validateOverdueComposition, serializeOverdueComposition } from '../src/domain/overdueReview.ts'
import { applyIntentContinuity } from '../src/domain/intentContinuity.ts'
import type { ResolvedIntent, IntentRequest } from '../src/domain/intent.ts'
const intent: ResolvedIntent = { goalType: 'overdue_review', projectId: 'atlas', clientId: 'northstar', dateRange: { from: '0001-01-01', to: '2026-10-11' } }
function setup() {
  const values = new Map<string,string>()
  const storage = createBrowserStorage(() => ({ getItem: k => values.get(k) ?? null, setItem: (k,v) => { values.set(k,v) }, removeItem: k => { values.delete(k) } }))
  const db = createBrowserDatabase(storage, { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: {}, dismissed: [], activity: [] }, { ...ADAPTIVE_DEMO, resources: RESOURCES })
  return { db, storage, reviews: createOverdueReviewService(db), tasks: createTaskService(db, () => DEMO_DATE), scheduling: createFocusSchedulingService(db, () => DEMO_DATE) }
}
test('overdue retrieval binds explicit project links, cutoff, status and date range', () => {
  const { reviews } = setup()
  const result = reviews.load(intent, DEMO_DATE); assert.equal(result.status, 'found'); if(result.status !== 'found') return
  assert.deepEqual(result.value.tasks.map(t=>t.id), ['task-4']); assert.equal(result.value.resources.length,2)
  assert.equal(reviews.load({ ...intent, projectId: 'missing' },DEMO_DATE).status,'missing')
  const empty = reviews.load({ ...intent, constraints: { status: 'pending' } }, DEMO_DATE); assert.equal(empty.status,'found'); if(empty.status==='found') assert.equal(empty.value.tasks.length,0)
  const range = reviews.load({ ...intent, dateRange: { from:'2026-10-11', to:'2026-10-11' } }, DEMO_DATE); if(range.status==='found') assert.equal(range.value.tasks.length,0)
})
test('conflicting project assignments and meeting-only links cannot import tasks', () => {
  const { db, reviews } = setup()
  db.writeCollection('relationships',[...ADAPTIVE_DEMO.relationships,{id:'conflict',sourceKind:'project',sourceId:'launch',targetKind:'task',targetId:'task-4',type:'related'}])
  const result=reviews.load(intent,DEMO_DATE); assert.equal(result.status,'found'); if(result.status==='found') assert.equal(result.value.tasks.length,0)
})
test('completion and due changes immediately narrow review; undo restores records', () => {
  const { db, tasks, reviews } = setup()
  tasks.toggle('task-4'); let result=reviews.load(intent,DEMO_DATE); if(result.status==='found') assert.equal(result.value.tasks.length,0)
  db.dispatch({type:'undo'}); result=reviews.load(intent,DEMO_DATE); if(result.status==='found') assert.equal(result.value.tasks.length,1)
  tasks.update('task-4',{due:DEMO_DATE}); result=reviews.load(intent,DEMO_DATE); if(result.status==='found') assert.equal(result.value.tasks.length,0)
})
test('local filters narrow the bound review and do not affect global filters', () => {
  const {db,reviews}=setup(); const result=reviews.load(intent,DEMO_DATE); if(result.status!=='found') throw Error('missing')
  assert.equal(filterTasks(result.value.tasks,{...emptyFilters(),query:'Alex'},DEMO_DATE).length,1)
  assert.equal(filterTasks(result.value.tasks,{...emptyFilters(),status:'completed'},DEMO_DATE).length,0)
  assert.equal(db.getState().filters.status,'all')
})
test('composition rejects unknown evidence and stale completed tasks', () => {
  const {reviews,tasks}=setup(); const loaded=reviews.load(intent,DEMO_DATE); if(loaded.status!=='found') throw Error('missing')
  const request={version:1 as const,kind:'overdue' as const,requestId:'r',intent,review:loaded.value}
  const plan={version:1 as const,requestId:'r',widgets:[{type:'context' as const,span:'wide' as const,reason:'Atlas scope',evidence:[{kind:'project' as const,id:'atlas'}]},{type:'tasks' as const,span:'full' as const,reason:'Outstanding onboarding',evidence:[{kind:'task' as const,id:'task-4'}]}]}
  assert.equal(validateOverdueComposition(plan,request).success,true)
  assert.equal(validateOverdueComposition({...plan,widgets:[...plan.widgets,plan.widgets[0]]},request).success,false)
  tasks.toggle('task-4'); const current=reviews.load(intent,DEMO_DATE); if(current.status!=='found') throw Error('missing')
  assert.equal(validateOverdueComposition(plan,{...request,review:current.value}).success,false)
})
test('focus slots use actual duration and metadata meetings; confirmation is revalidated and idempotent', () => {
  const {tasks,scheduling,db}=setup()
  assert.equal(scheduling.findSlots({taskId:'task-4',date:DEMO_DATE,intent}).ok,false)
  tasks.update('task-4',{status:'pending',duration:45})
  const slots=scheduling.findSlots({taskId:'task-4',date:'2026-10-13',intent}); assert.equal(slots.ok,true); if(!slots.ok) return
  assert.ok(!slots.value.some(s=>s.start<'15:00' && s.end>'14:00'))
  assert.ok(!slots.value.some(s=>s.start<'11:00' && s.end>'10:00'))
  const slot=slots.value[0]; const input={taskId:'task-4',date:slot.date,start:slot.start,intent,expectedDuration:45}
  const result=scheduling.schedule(input); assert.equal(result.ok,true); assert.equal(scheduling.schedule(input).ok,true)
  assert.equal(db.getState().events.filter(e=>e.id==='recommendation-task-4').length,1)
  assert.equal(db.getState().tasks.find(t=>t.id==='task-4')?.status,'pending')
  db.dispatch({type:'undo'}); assert.ok(!db.getState().events.some(e=>e.id==='recommendation-task-4'))
  tasks.update('task-4',{duration:60}); assert.equal(scheduling.schedule(input).ok,false)
})
test('malformed scheduling collections are unavailable and full days have no slots', () => {
  const {db,tasks,scheduling}=setup(); tasks.update('task-4',{status:'pending'})
  for (const event of db.getState().events.filter(e => e.date === DEMO_DATE)) db.dispatch({type:'delete-event',id:event.id})
  db.dispatch({type:'event',event:{id:'busy',title:'Busy',date:DEMO_DATE,start:'09:00',end:'18:00',category:'class',participants:[],agenda:''}})
  const result=scheduling.findSlots({taskId:'task-4',date:DEMO_DATE,intent}); assert.ok(result.ok && !result.value.length)
  db.writeCollection('meetings',[{id:'broken'}]); assert.equal(scheduling.findSlots({taskId:'task-4',date:DEMO_DATE,intent}).ok,false)
})
test('overdue sessions persist local refinements without clearing records or legacy layout compatibility', () => {
  const {storage}=setup(); const layouts=createLayoutService(storage,()=>true)
  const composition={version:1 as const,requestId:'r',widgets: ['context','tasks'].map(type=>({type:type as 'context'|'tasks',span:'full' as const,reason:'Atlas records',evidence:[{kind:'project' as const,id:'atlas'}]}))}
  const session={version:2 as const,kind:'overdue' as const,projectId:'atlas',referenceDate:DEMO_DATE,intent,composition,response:serializeOverdueComposition(composition),filters:{...emptyFilters(),query:'Alex'}}
  assert.equal(layouts.saveOverdue(session).status,'saved'); assert.deepEqual(layouts.loadSession(),{status:'found',value:session})
  layouts.clear(); assert.equal(layouts.loadSession().status,'missing'); assert.equal(layouts.save('legacy').status,'saved')
})
test('bounded follow-ups retain project and dates and can clear status', () => {
  const request={goal:'Only blocked tasks',followUpOf:'previous',previousIntent:intent} as IntentRequest
  const result=applyIntentContinuity({status:'resolved',intent:{goalType:'overdue_review'}},request) as {intent:ResolvedIntent}
  assert.equal(result.intent.projectId,'atlas'); assert.equal(result.intent.constraints?.status,'blocked')
  const all=applyIntentContinuity({status:'resolved',intent:{}},{...request,goal:'Show all overdue tasks',previousIntent:result.intent}) as {intent:ResolvedIntent}
  assert.equal(all.intent.constraints?.status,undefined); assert.deepEqual(all.intent.dateRange,intent.dateRange)
})
