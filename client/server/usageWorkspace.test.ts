import { emptyFilters } from '../src/domain/workspace.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createUsageWorkspaceService } from '../src/services/usageWorkspaceService.ts'
import { createUsageCompositionService } from '../src/services/usageCompositionService.ts'
import { createLayoutService, usageLayoutSchema } from '../src/services/layoutService.ts'
import { applyIntentContinuity } from '../src/domain/intentContinuity.ts'
import { validateIntentResolution, type IntentRequest, type ResolvedIntent } from '../src/domain/intent.ts'
import { usageComposeRequestSchema, validateUsageComposition, serializeUsageComposition, usageSnapshotFingerprint, type UsageComposeRequest } from '../src/domain/usageComposition.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import { INITIAL_TASKS, INITIAL_EVENTS, RESOURCES } from './fixtures/demo.ts'
const intent: ResolvedIntent={goalType:'usage_investigation',clientId:'northstar',projectId:'atlas',dateRange:{from:'2026-10-05',to:'2026-10-11'},constraints:{segment:'mobile'}}
function setup() {
  const values=new Map<string,string>()
  const storage=createBrowserStorage(()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)},removeItem:key=>{values.delete(key)}}))
  const db=createBrowserDatabase(storage,{tasks:INITIAL_TASKS,events:INITIAL_EVENTS,drafts:{},dismissed:[],activity:[]},{...ADAPTIVE_DEMO,...USAGE_DEMO,resources:RESOURCES})
  const service=createUsageWorkspaceService(db), result=service.load(intent)
  assert.ok(result.status==='found')
  const input:UsageComposeRequest={version:1,kind:'usage',requestId:'usage-test',intent,snapshot:result.value.snapshot,draft:''}
  const composition={version:1 as const,requestId:'usage-test',widgets:[{type:'context' as const,span:'narrow' as const,reason:'Selected client and project.',evidence:[{kind:'client' as const,id:'northstar'}]},{type:'usage' as const,span:'wide' as const,reason:'Selected mobile measurements.',evidence:[{kind:'observation' as const,id:result.value.observations[0].id}]},{type:'outline' as const,span:'full' as const,reason:'Keep investigation notes.',evidence:[{kind:'project' as const,id:'atlas'}]}]}
  return {db,service,storage,input,composition}
}
test('usage workspace selects owned records and explicit project work without task Context',()=>{
  const {input}=setup(), data=input.snapshot
  assert.equal(data.observations.length,7)
  assert.ok(data.tasks.length>0)
  assert.ok(data.relationships.every(r=>r.sourceId==='atlas'))
  assert.ok(data.tasks.every(t=>!('context' in t)))
  assert.ok(data.resources.every(r=>r.id!=='projectbrief'))
  assert.ok(data.communications.every(r=>r.clientId==='northstar'&&r.date<='2026-10-11'))
  assert.ok(data.issues.every(r=>r.clientId==='northstar'&&r.status==='open'))
  assert.equal(usageComposeRequestSchema.safeParse(input).success,true)
})
test('composition rejects invented evidence, duplicate widgets and mismatched scope',()=>{
  const {input,composition}=setup()
  assert.equal(validateUsageComposition(composition,input).success,true)
  assert.equal(validateUsageComposition({...composition,requestId:'stale'},input).success,false)
  assert.equal(validateUsageComposition({...composition,widgets:[...composition.widgets,composition.widgets[0]]},input).success,false)
  assert.equal(validateUsageComposition({...composition,widgets:composition.widgets.map(w=>({...w,evidence:[{kind:'project',id:'launch'}]}))},input).success,false)
  assert.equal(usageComposeRequestSchema.safeParse({...input,intent:{...intent,clientId:'westbridge'}}).success,false)
  assert.equal(usageComposeRequestSchema.safeParse({...input,snapshot:{...input.snapshot,observations:USAGE_DEMO.usageObservations.filter(r=>r.clientId==='westbridge')}}).success,false)
})
test('usage layout persists scope/composition only and restores without changing records',()=>{
  const {storage,input,composition}=setup()
  const layouts=createLayoutService(storage,()=>true)
  const session={version:2 as const,kind:'usage' as const,taskFilters:emptyFilters(),intent,composition,response:serializeUsageComposition(composition),snapshotFingerprint:usageSnapshotFingerprint(input.snapshot)}
  assert.equal(layouts.saveUsage(session).status,'saved')
  const reloaded=createLayoutService(storage,()=>true).loadSession()
  assert.deepEqual(reloaded,{status:'found',value:session})
  assert.equal(usageLayoutSchema.safeParse({...session,response:'made up'}).success,false)
  assert.equal('snapshot' in session,false)
})
test('empty measurements retain a valid owned scope, while missing and malformed data are distinct',()=>{
  const {db,service}=setup()
  db.writeCollection('usageObservations',[])
  const empty=service.load(intent)
  assert.ok(empty.status==='found');assert.equal(empty.value.observations.length,0)
  assert.equal(service.load({...intent,clientId:'missing'}).status,'missing')
  db.writeCollection('usageObservations',[{wrong:'record'}])
  assert.equal(service.load(intent).status,'invalid')
})
test('usage follow-ups inherit unchanged scope and clear segments or replace client ownership explicitly',()=>{
  const {db}=setup(),catalog=createAdaptiveDataService(db).loadCandidates()
  assert.ok(catalog.status==='found')
  const request:IntentRequest={version:1,requestId:'follow-up',goal:'Focus on desktop traffic',referenceDate:'2026-10-12',timezone:'Asia/Kolkata',candidates:catalog.value,followUpOf:'usage-test',previousIntent:intent}
  const base={version:1,requestId:request.requestId,originalGoal:request.goal,status:'resolved',intent:{goalType:'usage_investigation',constraints:{segment:'desktop'}},scopeChanges:['segment']}
  const resolved=validateIntentResolution(applyIntentContinuity(base,request),request)
  assert.ok(resolved.success&&resolved.data.status==='resolved')
  assert.deepEqual(resolved.data.intent,{...intent,constraints:{segment:'desktop'}})
  const all=validateIntentResolution(applyIntentContinuity({...base,intent:{goalType:'usage_investigation'},scopeChanges:['segment']},request),request)
  assert.ok(all.success&&all.data.status==='resolved');assert.deepEqual(all.data.intent.constraints,{})
  const switched=validateIntentResolution(applyIntentContinuity({...base,intent:{goalType:'usage_investigation',projectId:'launch'},scopeChanges:['projectId','segment']},request),request)
  assert.ok(switched.success&&switched.data.status==='resolved');assert.equal(switched.data.intent.clientId,'westbridge')
  assert.equal(switched.data.intent.projectId,'launch')
  assert.equal(validateIntentResolution({...base,intent,scopeChanges:undefined},request).success,false)
})
test('HTTP composition sends only scoped records and rejects invalid provider responses',async()=>{
  const {input,composition}=setup()
  const service=createUsageCompositionService(async(_url,options)=>{
    assert.deepEqual(JSON.parse(options!.body as string),input)
    return new Response(JSON.stringify(composition),{status:200,headers:{'Content-Type':'application/json'}})
  })
  assert.deepEqual(await service.compose(input),composition)
  const invalid=createUsageCompositionService(async()=>new Response(JSON.stringify({...composition,requestId:'other'})))
  await assert.rejects(()=>invalid.compose(input),/Invalid usage composition/)
})

test('usage continuity rejects contradictory declared ownership and malformed fields',()=>{
  const {db}=setup(), catalog=createAdaptiveDataService(db).loadCandidates()
  assert.ok(catalog.status==='found')
  const request:IntentRequest={version:1,requestId:'change',goal:'Switch client and project',referenceDate:'2026-10-12',timezone:'Asia/Kolkata',candidates:catalog.value,previousIntent:intent,followUpOf:'usage-test'}
  const response={version:1,requestId:'change',originalGoal:request.goal,status:'resolved',scopeChanges:['clientId','projectId'],intent:{goalType:'usage_investigation',clientId:'westbridge',projectId:'atlas'}}
  assert.equal(validateIntentResolution(applyIntentContinuity(response,request),request).success,false)
  assert.equal(validateIntentResolution(applyIntentContinuity({...response,intent:{...response.intent,unrecognized:'ignored?'}},request),request).success,false)
})
