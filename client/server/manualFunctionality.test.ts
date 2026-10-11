import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createBrowserStorage} from '../src/services/local/browserStorage.ts'
import {createBrowserDatabase} from '../src/services/browserDatabase.ts'
import {createTaskService} from '../src/services/taskService.ts'
import {createResourceService} from '../src/services/resourceService.ts'
import {createUsageDataService} from '../src/services/usageDataService.ts'
import {getActivityRecords} from '../src/services/recordHistory.ts'
function setup(){const data=new Map<string,string>();const storage=createBrowserStorage(()=>({getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,value)},removeItem:key=>{data.delete(key)}}));const seed={tasks:[],events:[],drafts:{},dismissed:[],activity:[]};const collections={resources:[],usageObservations:[],usageReleases:[],meetings:[],communications:[],issues:[],relationships:[]};return {database:createBrowserDatabase(storage,seed,collections),reload:()=>createBrowserDatabase(storage,seed,collections)}}
test('manual task lifecycle refreshes state and retains durable completion evidence',()=>{
 const {database,reload}=setup(),tasks=createTaskService(database,()=> '2026-10-11',()=> 't')
 const created=tasks.create({title:'Prepare review',description:'',owner:'Alex',due:'2026-10-12',duration:30,priority:'high',status:'pending'});assert.ok(created.ok)
 assert.ok(tasks.toggle('t').ok);assert.equal(database.getState().tasks[0].status,'completed');assert.equal(getActivityRecords(database).filter(r=>r.completion).length,1)
 assert.ok(tasks.delete('t').ok);assert.equal(database.getState().tasks.length,0);database.dispatch({type:'undo'});assert.equal(database.getState().tasks[0].status,'completed')
 const records=getActivityRecords(reload());assert.equal(records.filter(r=>r.completion).length,1);assert.ok(records.every(r=>Number.isFinite(Date.parse(r.at))));assert.equal(reload().getState().tasks.length,1)
})
test('resource CRUD notifies collection consumers without mutating domain records',()=>{
 const {database}=setup(),resources=createResourceService([],database),state=database.getState(),revision=database.getRevision();let notifications=0;const unsubscribe=database.subscribe(()=>notifications++)
 const result=resources.create({title:'Brief',kind:'document',context:'Project',body:'Original'});assert.ok(result.ok);if(!result.ok)return
 assert.ok(resources.update(result.value.id,{body:'Edited'}).ok);assert.equal(resources.getById(result.value.id)?.body,'Edited');assert.ok(resources.delete(result.value.id).ok);assert.equal(resources.list().length,0)
 assert.equal(database.getState(),state);assert.ok(database.getRevision()>revision);assert.equal(notifications,3);assert.equal(getActivityRecords(database).length,3);unsubscribe()
})
test('usage import is atomic, validates ownership and prevents duplicates across a batch and existing records',()=>{
 const {database}=setup(),usage=createUsageDataService(database),row={date:'2026-10-11',segment:'web',sessions:20}
 assert.equal(usage.importObservations([row,{...row}]).ok,false);assert.equal(usage.observations.list().length,0)
 assert.equal(usage.importObservations([row,row]).ok,false);assert.equal(usage.observations.list().length,0)
 assert.equal(usage.importObservations([row,{...row,date:'2026-10-12',sessions:0}]).ok,true);assert.equal(usage.observations.list().length,2)
 assert.equal(usage.importObservations([row]).ok,false);assert.equal(usage.observations.list().length,2)
 assert.equal(usage.importObservations([{...row,date:'2026-02-31'}]).ok,false)
})

test('meeting task creation validates meeting scope and installs a direct link',async()=>{
 const {createWorkspaceActionService}=await import('../src/services/workspaceActionService.ts'),{localSetup}=await import('./fixtures/localSetup.ts')
 const {database}=localSetup(true),actions=createWorkspaceActionService(database),loaded=database.readCollection('meetings');assert.ok(loaded.status==='found');const meetingId=(loaded.value as {id:string}[]).at(-1)!.id
 const origin={binding:{kind:'meeting' as const,meetingId},referenceDate:'2026-10-11',revision:0},input={title:'Follow-up',description:'',owner:'Alex',due:'2026-10-12',duration:30,priority:'high' as const,status:'pending' as const}
 assert.equal(actions.createTask({...origin,binding:{kind:'meeting',meetingId:'missing'}},input).ok,false)
 const result=actions.createTask(origin,input);assert.ok(result.ok)
 const links=database.readCollection('relationships');assert.ok(links.status==='found');assert.ok((links.value as {targetId:string;sourceId:string}[]).some(link=>link.targetId===result.value.id&&link.sourceId===meetingId))
})
test('failed record transaction rolls back tasks, collections and activity before notifying consumers',()=>{
 const {database,reload}=setup(),tasks=createTaskService(database,()=> '2026-10-11',()=> 'rollback-task');let calls=0;database.subscribe(()=>calls++)
 const result=database.transaction(()=>{tasks.create({title:'Temporary',description:'',owner:'Alex',due:'2026-10-12',duration:30,priority:'high',status:'pending'});database.writeCollection('relationships',[{id:'temporary'}]);return {ok:false,message:'Simulated failure'}})
 assert.equal(result.ok,false);assert.equal(database.getState().tasks.length,0);assert.equal(reload().getState().tasks.length,0);assert.equal(getActivityRecords(database).length,0);assert.equal(calls,1)
})
