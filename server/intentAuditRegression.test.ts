import test from 'node:test'
import assert from 'node:assert/strict'
import {fallbackComponentIntent,validateComponentResolution,type ComponentRequest} from '../client/src/domain/componentIntent.ts'
const input:ComponentRequest={goal:'',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],draftKeys:[],topics:[]}}
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
for(const goal of ['remove all component from this page','Remove all components from this page','Clear all widgets on this page','Delete all cards in the current workspace','Please remove all panels from my canvas','Remove current existing all component from this page','Remove all components from this page and show resources'])test(`page-scoped clear is explicitly authorized: ${goal}`,()=>{
 const request={...input,goal},candidate={action:'manage',operations:[{type:'clear'},...(goal.includes('show resources')?[{type:'add',widgets:['resources']}]:[])],reply:'Workspace updated.'}
 assert.equal(validateComponentResolution(candidate,request).success,true)
 const fallback=fallbackComponentIntent(request);assert.equal(fallback.action,'manage');if(fallback.action==='manage')assert.equal(fallback.operations[0].type,'clear')
})
for(const goal of ['Do not remove all component from this page','How do I remove all components from this page?','If I remove all component from this page, what happens?','Remove all task records from this page','Remove all resources from storage','Remove all components from the database'])test(`page wording never bypasses removal safety: ${goal}`,()=>{
 assert.equal(validateComponentResolution({action:'manage',operations:[{type:'clear'}],reply:'Clear'}, {...input,goal}).success,false)
})
