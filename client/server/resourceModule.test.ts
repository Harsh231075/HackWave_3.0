import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createResourceModuleService, resourceDraftInputSchema } from '../src/services/resourceModuleService.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES } from './fixtures/demo.ts'
import { fallbackComponentIntent, validateComponentResolution, type ComponentRequest } from '../src/domain/componentIntent.ts'
import { applyComponentView } from '../src/domain/instanceViews.ts'
import { emptyWorkspace } from '../src/domain/workspaceDocument.ts'
import { makeInstance } from '../src/domain/widgetInstances.ts'
const request:ComponentRequest={goal:'Create a new resource',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],projects:[],clients:[],draftKeys:[],topics:[]}}
const input={title:'Review reference',kind:'note',context:'Review',body:'Notes',description:'Supporting reference',tags:['design'],links:[{kind:'project' as const,id:'atlas'},{kind:'task' as const,id:'task-1'}]}
function setup(){const values=new Map<string,string>();const database=createBrowserDatabase(createBrowserStorage(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)},removeItem:key=>{values.delete(key)}})),{tasks:INITIAL_TASKS,events:INITIAL_EVENTS,drafts:{},dismissed:[],activity:[]},{...ADAPTIVE_DEMO,resources:RESOURCES});return {database,module:createResourceModuleService(database,RESOURCES),values}}
test('resource prompt renders creation forms while retaining existing canvas and independent instance IDs',()=>{
 const resolved=fallbackComponentIntent(request);assert.equal(resolved.action,'view');if(resolved.action!=='view')return
 assert.deepEqual(resolved.widgets,['resource-create']);assert.equal(validateComponentResolution({...resolved,source:'ai'},request).success,true)
 const old={...emptyWorkspace(),active:[makeInstance('tasks')]}
 const first=applyComponentView(old,resolved,request.goal),second=applyComponentView(first,resolved,request.goal)
 assert.equal(second.active.filter(i=>i.widgetType==='resource-create').length,2)
 assert.equal(new Set(second.active.map(i=>i.instanceId)).size,3);assert.equal(second.active[0].instanceId,old.active[0].instanceId)
})
test('resource drafts allow incomplete input and stay separate across service remounts',()=>{
 const {database,module}=setup();const incomplete=resourceDraftInputSchema.partial().parse({...input,title:'',kind:'link',body:'not yet a URL'})
 module.saveDraft('a',{input:incomplete});module.saveDraft('b',{input:{...input,title:'Other'}})
 const fresh=createResourceModuleService(database,RESOURCES)
 assert.equal((fresh.loadDraft('a') as {input:typeof input}).input.title,'');assert.equal((fresh.loadDraft('b') as {input:typeof input}).input.title,'Other')
 assert.equal(module.resources.list().length,RESOURCES.length)
})
test('manual resource creation saves metadata and existing project relationships in one shared store',()=>{
 const {database,module}=setup(),saved=module.save(input);assert.equal(saved.ok,true);if(!saved.ok)return
 assert.equal(module.resources.getById(saved.value.id)?.title,input.title)
 assert.equal(module.properties(saved.value.id).links.length,2)
 const links=database.readCollection('relationships');assert.equal(links.status,'found');if(links.status==='found')assert.ok((links.value as Array<{targetId:string}>).some(l=>l.targetId===saved.value.id))
 const original={record:saved.value,properties:module.properties(saved.value.id)}
 const updated=module.save({...input,title:'Updated reference',tags:['revised']},saved.value.id,original);assert.equal(updated.ok,true)
 assert.equal(createResourceModuleService(database,RESOURCES).properties(saved.value.id).tags[0],'revised')
 assert.equal(module.save(input,saved.value.id,original).ok,false)
 assert.equal(module.delete(saved.value.id,module.resources.getById(saved.value.id)!).ok,true)
 assert.equal(module.resources.getById(saved.value.id),null)
 const after=database.readCollection('relationships');if(after.status==='found')assert.ok(!(after.value as Array<{targetId:string}>).some(l=>l.targetId===saved.value.id))
})
test('invalid link, missing linked record and broken properties never mutate resources',()=>{
 const {database,module}=setup();const count=module.resources.list().length
 assert.equal(module.save({...input,kind:'link',body:'javascript:alert(1)'}).ok,false)
 assert.equal(module.save({...input,links:[{kind:'task',id:'gone'}]}).ok,false)
 database.writeCollection('resourceProperties',{broken:42})
 assert.equal(module.save(input).ok,false);assert.equal(module.resources.list().length,count)
})
test('legacy project links remain present in resource editors',()=>{
 const {module}=setup();assert.ok(module.properties('project-brief').links.length>0)
})
test('attachments reuse local file storage and cannot reference a missing file',async()=>{
 const {module}=setup();assert.equal(module.save({...input,kind:'attachment',body:'file:missing'}).ok,false)
 const upload=await module.files.upload(new Blob(['hello'],{type:'text/plain'}),'reference.txt');assert.equal(upload.ok,true);if(!upload.ok)return
 const result=module.save({...input,kind:'attachment',body:'file:'+upload.value.id});assert.equal(result.ok,true)
 const tooLarge=await module.files.upload(new Blob([new Uint8Array(2*1024*1024+1)]),'large');assert.equal(tooLarge.ok,false)
})
test('show resources and remove current existing components accepts AI clear and preserves requested addition',async()=>{
 const {normalizeModelIntent}=await import('./componentModelIntent.ts')
 const input={...request,goal:'show my all resources and remove current existing all components'}
 const candidate=normalizeModelIntent({action:'manage',operations:[{type:'add',widgets:['resources']},{type:'clear'}],reply:'Only resources.'},input)
 const validated=validateComponentResolution(candidate,input);assert.equal(validated.success,true)
 const fallback=fallbackComponentIntent(input);assert.equal(fallback.action,'manage');if(fallback.action==='manage')assert.deepEqual(fallback.operations,[{type:'clear'},{type:'add',widgets:['resources']}])
 for(const goal of ['Do not remove current existing all components','How do I remove current existing all components?','Remove all overdue task records'])assert.equal(validateComponentResolution({action:'manage',operations:[{type:'clear'}],reply:'Clear'}, {...request,goal}).success,false)
})
