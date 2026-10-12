import test from 'node:test'
import assert from 'node:assert/strict'
import { applyIntentContinuity } from '../client/src/domain/intentContinuity.ts'
import { continuationChangeSchema,type IntentChanges } from '../client/src/domain/intentChanges.ts'
import { validateIntentResolution,type IntentRequest } from '../client/src/domain/intent.ts'
import { componentViewSchema } from '../client/src/domain/componentIntent.ts'
import { applyComponentView } from '../client/src/domain/instanceViews.ts'
import { makeInstance } from '../client/src/domain/widgetInstances.ts'
import { emptyWorkspace } from '../client/src/domain/workspaceDocument.ts'
const previous={goalType:'overdue_review' as const,dateRange:{from:'2026-10-01',to:'2026-10-10'}}
const request:IntentRequest={version:2,requestId:'r',goal:'Only blocked items',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',candidates:{meetings:[]},previousIntent:previous,followUpOf:'first'}
const refinement=(changes:IntentChanges)=>({relationship:'refinement' as const,targetInstanceIds:[],changes})
const response={version:2,requestId:'r',originalGoal:request.goal,status:'resolved',intent:previous}
test('explicit changes accumulate constraints and preserve dates, clear removes only requested filters',()=>{
 const blocked=applyIntentContinuity(response,{...request,continuation:refinement({status:{operation:'set',value:'blocked'}})})
 const validated=validateIntentResolution(blocked,request);assert.ok(validated.success&&validated.data.status==='resolved')
 const high=applyIntentContinuity(response,{...request,previousIntent:validated.data.intent,continuation:refinement({priority:{operation:'set',value:'high'}})})
 const checked=validateIntentResolution(high,request);assert.ok(checked.success&&checked.data.status==='resolved');assert.deepEqual(checked.data.intent.constraints,{status:'blocked',priority:'high'});assert.deepEqual(checked.data.intent.dateRange,previous.dateRange)
 const cleared=applyIntentContinuity(response,{...request,previousIntent:checked.data.intent,continuation:refinement({status:{operation:'clear'}})});const result=validateIntentResolution(cleared,request);assert.ok(result.success&&result.data.status==='resolved');assert.deepEqual(result.data.intent.constraints,{priority:'high'})
})
test('new goals and clarification answers never inherit prior workflow scope',()=>{assert.deepEqual(applyIntentContinuity(response,{...request,continuation:{relationship:'new_goal',targetInstanceIds:[],changes:{}}}),response)})
test('usage follow-ups retain dates and select/clear segments',()=>{
 const usage={goalType:'usage_investigation' as const,dateRange:previous.dateRange,constraints:{segment:'web'}},input={...request,previousIntent:usage}
 const value=applyIntentContinuity({...response,intent:usage},{...input,continuation:refinement({segment:{operation:'clear'}})});const checked=validateIntentResolution(value,input);assert.ok(checked.success&&checked.data.status==='resolved');assert.equal(checked.data.intent.constraints?.segment,undefined);assert.deepEqual(checked.data.intent.dateRange,usage.dateRange)
})
test('meeting date change clarifies among actual matching candidates',()=>{
 const input={...request,previousIntent:{goalType:'meeting_preparation' as const,meetingId:'old',dateRange:previous.dateRange},candidates:{meetings:[{id:'old',label:'Old',date:'2026-10-10'},{id:'a',label:'Morning',date:'2026-10-12'},{id:'b',label:'Afternoon',date:'2026-10-12'}]},continuation:refinement({dateRange:{operation:'set',value:{from:'2026-10-12',to:'2026-10-12'}}})}
 const result=validateIntentResolution(applyIntentContinuity(response,input),input);assert.ok(result.success&&result.data.status==='needs_clarification');assert.equal(result.data.choices.length,2)
})
test('contracts reject removed organizational changes and undeclared handlers',()=>{assert.equal(continuationChangeSchema.safeParse({relationship:'refinement',targetInstanceIds:[],changes:{projectId:{operation:'set',value:'old'}}}).success,false);assert.equal(continuationChangeSchema.safeParse({relationship:'refinement',changes:{handler:'eval'}}).success,false)})
test('component refinements preserve instance IDs, accumulate filters and keep pins',()=>{
 const task=makeInstance('tasks'),document={...emptyWorkspace(),active:[task]}
 const view=componentViewSchema.parse({action:'view',widgets:['tasks'],bindings:{},reply:'Updated',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',continuation:refinement({status:{operation:'set',value:'blocked'}})})
 const next=applyComponentView(document,view,'Only blocked tasks');assert.equal(next.active[0].instanceId,task.instanceId);assert.equal(next.active[0].viewState.taskFilters.status,'blocked')
 const high=applyComponentView(next,{...view,continuation:refinement({priority:{operation:'set',value:'high'}})},'High priority too');assert.equal(high.active[0].viewState.taskFilters.status,'blocked');assert.equal(high.active[0].viewState.taskFilters.priority,'high')
})
test('clearing required dates asks for dates and keeps other constraints',()=>{
 const input={...request,previousIntent:{...previous,constraints:{priority:'high' as const}},continuation:refinement({dateRange:{operation:'clear'}})}
 const result=validateIntentResolution(applyIntentContinuity(response,input),input)
 assert.ok(result.success&&result.data.status==='needs_clarification')
 assert.equal(result.data.field,'dateRange');assert.equal(result.data.partialIntent.constraints?.priority,'high')
})
test('declared usage scopeChanges retain undeclared dates and support segment clearing',()=>{
 const usage={goalType:'usage_investigation' as const,dateRange:previous.dateRange,constraints:{segment:'web'}},input={...request,previousIntent:usage}
 const result=validateIntentResolution(applyIntentContinuity({...response,intent:{...usage,dateRange:{from:'2026-09-01',to:'2026-09-30'},constraints:{}},scopeChanges:['segment']},input),input)
 assert.ok(result.success&&result.data.status==='resolved');assert.deepEqual(result.data.intent.dateRange,previous.dateRange);assert.equal(result.data.intent.constraints?.segment,undefined)
})
