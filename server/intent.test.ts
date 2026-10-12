import test from 'node:test'
import assert from 'node:assert/strict'
import { intentRequestSchema,validateIntentResolution,resolvedIntentSchema,type IntentRequest } from '../client/src/domain/intent.ts'
import { createIntentService } from '../client/src/services/intentService.ts'
const request:IntentRequest={version:2,requestId:'r',goal:'Prepare tomorrow’s meeting',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',candidates:{meetings:[{id:'a',label:'Morning review',date:'2026-10-12'},{id:'b',label:'Afternoon review',date:'2026-10-12'}]}}
const intent={goalType:'meeting_preparation' as const,meetingId:'a',dateRange:{from:'2026-10-12',to:'2026-10-12'}}
const resolved={version:2,requestId:'r',originalGoal:request.goal,status:'resolved',intent}
const question={version:2 as const,requestId:'r',originalGoal:request.goal,status:'needs_clarification' as const,field:'meetingId' as const,question:'Which meeting?',choices:request.candidates.meetings.map(m=>({id:m.id,label:m.label})),partialIntent:{goalType:'meeting_preparation' as const,dateRange:intent.dateRange}}
test('v2 contracts require a meeting for preparation; usage and overdue use dates without organizations',()=>{
 assert.equal(intentRequestSchema.safeParse(request).success,true);assert.equal(intentRequestSchema.safeParse({...request,version:1}).success,false)
 assert.equal(resolvedIntentSchema.safeParse(intent).success,true);assert.equal(resolvedIntentSchema.safeParse({...intent,meetingId:undefined}).success,false)
 for(const goalType of ['usage_investigation','overdue_review'])assert.equal(resolvedIntentSchema.safeParse({goalType,dateRange:intent.dateRange}).success,true)
 assert.equal(resolvedIntentSchema.safeParse({...intent,projectId:'old'}).success,false)
})
test('resolution rejects stale IDs, dates, request identity and invented choices',()=>{
 assert.equal(validateIntentResolution(resolved,request).success,true)
 for(const patch of [{requestId:'old'},{originalGoal:'different'},{intent:{...intent,meetingId:'missing'}},{intent:{...intent,dateRange:{from:'bad',to:'2026-10-12'}}}])assert.equal(validateIntentResolution({...resolved,...patch},request).success,false)
 assert.equal(validateIntentResolution(question,request).success,true);assert.equal(validateIntentResolution({...question,choices:[{id:'a',label:'Invented'},question.choices[1]]},request).success,false)
 assert.equal(intentRequestSchema.safeParse({...request,candidates:{meetings:[request.candidates.meetings[0],request.candidates.meetings[0]]}}).success,false)
})
test('clarification answer must match the offered question and is authoritative',()=>{
 const follow={...request,clarificationContext:{requestId:'r',originalGoal:request.goal,field:question.field,choices:question.choices,partialIntent:question.partialIntent},clarificationAnswer:{requestId:'r',originalGoal:request.goal,field:'meetingId' as const,selectedId:'b'}}
 assert.equal(intentRequestSchema.safeParse(follow).success,true);assert.equal(validateIntentResolution(resolved,follow).success,false);assert.equal(validateIntentResolution({...resolved,intent:{...intent,meetingId:'b'}},follow).success,true)
 assert.equal(intentRequestSchema.safeParse({...follow,clarificationContext:undefined}).success,false)
})
test('unknown usage segments and removed organization fields are rejected',()=>{
 const input={...request,candidates:{...request.candidates,usageScopes:[{segments:['web'],dateRange:intent.dateRange}]}}
 assert.equal(validateIntentResolution({...resolved,intent:{goalType:'usage_investigation',dateRange:intent.dateRange,constraints:{segment:'unknown'}}},input).success,false)
 assert.equal(intentRequestSchema.safeParse({...request,candidates:{...request.candidates,clients:[]}}).success,false)
})
test('service validates transport responses and respects cancellation',async()=>{
 assert.deepEqual(await createIntentService(async()=>resolved).resolve(request),resolved)
 await assert.rejects(()=>createIntentService(async()=>({...resolved,requestId:'old'})).resolve(request))
 const controller=new AbortController();controller.abort();await assert.rejects(()=>createIntentService(async()=>resolved).resolve(request,{signal:controller.signal}))
})
test('removed named scope cannot be accepted as a broad resolved query',()=>{
 const input={...request,goal:'Review tasks for project Alpha'}
 const value={version:2,requestId:input.requestId,originalGoal:input.goal,status:'resolved',intent:{goalType:'overdue_review',dateRange:{from:'2026-10-01',to:'2026-10-10'}}}
 assert.equal(validateIntentResolution(value,input).success,false)
 assert.equal(validateIntentResolution({version:2,requestId:input.requestId,originalGoal:input.goal,status:'unsupported',reason:'Choose an owner or dates.'},input).success,true)
})
