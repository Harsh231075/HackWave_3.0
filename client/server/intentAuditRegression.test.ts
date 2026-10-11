import test from 'node:test'
import assert from 'node:assert/strict'
import {fallbackComponentIntent,validateComponentResolution,type ComponentRequest} from '../src/domain/componentIntent.ts'
const input:ComponentRequest={goal:'',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],clients:[],projects:[],draftKeys:[],topics:[]}}
for(const goal of ['Remove the word "all" from my notes','Delete all task records','Delete all pending tasks','Remove all resources from storage'])test(`record/text intent cannot execute layout deletion: ${goal}`,()=>{
 const request={...input,goal},result=fallbackComponentIntent(request);assert.equal(result.action,'clarify')
 assert.equal(validateComponentResolution({action:'manage',operations:[{type:'clear'}],reply:'Clear'},request).success,false)
})
for(const [goal,widget]of [['Show work items','tasks'],['Show schedule grid','calendar'],['Show summary','metrics'],['Add resources to my current workspace','resources'],['Open a resource creation form','resource-create'],['Khali time slots dikhao','availability']] as const)test(`audited routing regression: ${goal}`,()=>{const result=fallbackComponentIntent({...input,goal});assert.equal(result.action,'view');if(result.action==='view')assert.deepEqual(result.widgets,[widget])})
test('combined resources and metrics retains both requested components',()=>{const result=fallbackComponentIntent({...input,goal:'Show resources and metrics'});assert.equal(result.action,'view');if(result.action==='view')assert.deepEqual(new Set(result.widgets),new Set(['resources','metrics']))})
for(const status of ['pending','blocked','completed','overdue'])test(`AI cannot invert requested ${status} status`,()=>{
 const request={...input,goal:`Show ${status} tasks`},result=fallbackComponentIntent(request);assert.equal(result.action,'view');if(result.action!=='view')return
 const wrong={...result,bindings:{...result.bindings,taskFilters:{...result.bindings.taskFilters,status:status==='completed'?'pending':'completed'}}}
 assert.equal(validateComponentResolution(wrong,request).success,false);assert.equal(validateComponentResolution(result,request).success,true)
})
