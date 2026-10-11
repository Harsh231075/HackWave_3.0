import {writeFile} from 'node:fs/promises'
import {validateComponentResolution} from '../../src/domain/componentIntent.ts'
const input={goal:'Show tasks',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:['Alex'],draftKeys:[],topics:[]}}
const view={action:'view',widgets:['tasks'],bindings:{taskFilters:{query:'',status:'all',priority:'all',sort:'due',from:'',to:''}},reply:'Showing tasks.',referenceDate:input.referenceDate,timezone:input.timezone}
const cases=[
 ['unknown widget',input,{...view,widgets:['payment-admin']},false],
 ['unknown owner',input,{...view,bindings:{owner:'Invented'}},false],
 ['unknown project',input,{...view,bindings:{}},false],
 ['unauthorized clear',input,{action:'manage',operations:[{type:'clear'}],reply:'Clear'},false],
 ['unknown removal target',{...input,goal:'Remove tasks component'},{action:'manage',operations:[{type:'remove',widgets:['fake-instance']}],reply:'Remove'},false],
 ['negated clear',{...input,goal:'Never clear the workspace'},{action:'manage',operations:[{type:'clear'}],reply:'Clear'},false],
 ['record deletion',{...input,goal:'Delete all task records'},{action:'manage',operations:[{type:'clear'}],reply:'Clear'},false],
 ['text-edit mistaken as component removal',{...input,goal:'Remove the word all from my notes'},{action:'manage',operations:[{type:'remove',widgets:['outline']}],reply:'Remove'},false],
 ['wrong reference date',input,{...view,referenceDate:'2026-10-12'},false],
 ['wrong timezone',input,{...view,timezone:'UTC'},false],
 ['reversed dates',input,{...view,bindings:{dateRange:{from:'2026-10-20',to:'2026-10-11'}}},false],
 ['requested date dropped',{...input,goal:'Show tasks tomorrow'},view,false],
 ['pending changed to completed',{...input,goal:'Show pending tasks'},{...view,bindings:{taskFilters:{...view.bindings.taskFilters,status:'completed'}}},false],
 ['blocked filter dropped',{...input,goal:'Show blocked tasks'},view,false],
 ['authorized view',input,view,true],
 ['authorized clear-and-add',{...input,goal:'Remove all components and show resources'},{action:'manage',operations:[{type:'clear'},{type:'add',widgets:['resources']}],reply:'Resources'},true],
]
const results=cases.map(([name,input,candidate,expected])=>{const actual=validateComponentResolution(candidate,input);return {name,expectedAccepted:expected,accepted:actual.success,passed:actual.success===expected,issues:actual.success?[]:actual.error.issues}})
const output={total:results.length,passed:results.filter(r=>r.passed).length,results};await writeFile(new URL('../../../audit/model-contracts.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2))
