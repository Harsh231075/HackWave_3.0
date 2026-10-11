import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createUsageDataService } from '../src/services/usageDataService.ts'
import { createUsageInvestigationService, type UsageInvestigation } from '../src/services/usageInvestigationService.ts'
import { createRecordStore } from '../src/services/preparationStore.ts'
import { ADAPTIVE_DEMO } from './fixtures/adaptiveDemo.ts'
import { USAGE_DEMO } from './fixtures/usageDemo.ts'
import { usageObservationSchema } from '../src/domain/usage.ts'
function setup() {
  const values = new Map<string,string>()
  const storage = createBrowserStorage(() => ({ getItem: key => values.get(key) ?? null, setItem: (key,value) => { values.set(key,value) }, removeItem: key => { values.delete(key) } }))
  const collections = { ...ADAPTIVE_DEMO, ...USAGE_DEMO }
  const database = createBrowserDatabase(storage, { tasks: [], events: [], drafts: {}, dismissed: [], activity: [] }, collections)
  return { values, storage, collections, database, data: createUsageDataService(database), service: createUsageInvestigationService(database) }
}
test('usage seeds are additive, lazy and expose both clients without initialization writes', () => {
  const {data,service,values}=setup()
  assert.equal(values.size,0)
  const catalog=data.loadCatalog(); assert.ok(catalog.status==='found'); assert.equal(catalog.value.clients.length,2)
  const northstar=service.load({clientId:'northstar'}), westbridge=service.load({clientId:'westbridge'})
  assert.ok(northstar.status==='found'&&westbridge.status==='found')
  assert.equal(northstar.value.observations.length,14); assert.equal(westbridge.value.observations.length,14)
  assert.ok(northstar.value.observations.every(r=>r.clientId==='northstar'&&r.projectId==='atlas'))
  assert.ok(westbridge.value.releases.every(r=>r.clientId==='westbridge'))
  assert.equal(values.size,0)
})
test('retrieval intersects client, project, inclusive dates and segment', () => {
  const {service}=setup()
  const result=service.load({clientId:'northstar',projectId:'atlas',segment:'mobile',dateRange:{from:'2026-10-07',to:'2026-10-09'}})
  assert.ok(result.status==='found'); assert.deepEqual(result.value.observations.map(r=>r.date),['2026-10-07','2026-10-08','2026-10-09'])
  assert.deepEqual(result.value.segments,['mobile']); assert.equal(result.value.releases[0].id,'atlas-mobile-release')
  assert.equal(service.load({clientId:'northstar',projectId:'launch'}).status,'invalid')
  assert.equal(service.load({clientId:'unknown'}).status,'missing')
  assert.equal(service.load({clientId:'northstar',dateRange:{from:'2026-02-30',to:'2026-10-09'}}).status,'invalid')
  assert.equal(service.load({clientId:'northstar',dateRange:{from:'2025-01-01',to:'2026-10-09'}}).status,'invalid')
})
test('computed endpoint changes and release filtering replace fixed widget conclusions', () => {
  const {service}=setup()
  const result=service.load({clientId:'northstar'}); assert.ok(result.status==='found')
  const mobile=result.value.comparisons.find(c=>c.segment==='mobile')!; assert.equal(mobile.baseline,620); assert.equal(mobile.current,420)
  assert.ok(Math.abs(mobile.changePercent!-(-200/620*100))<1e-8); assert.match(mobile.explanation,/-32\.3%/)
  const desktop=service.load({clientId:'northstar',segment:'desktop'}); assert.ok(desktop.status==='found'); assert.equal(desktop.value.releases.length,0)
  const other=service.load({clientId:'westbridge',segment:'desktop'}); assert.ok(other.status==='found'); assert.equal(other.value.comparisons[0].changePercent,10)
  assert.match(other.value.releaseExplanation,/does not establish causation/)
})
test('zero baselines, missing endpoints, gaps and single dates never invent percentages', () => {
  const {data,service}=setup()
  assert.ok(data.observations.update('atlas-2026-10-05-mobile',{sessions:0}).ok)
  let result=service.load({clientId:'northstar',segment:'mobile'}); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].changePercent,null); assert.match(result.value.comparisons[0].explanation,/zero baseline/)
  data.observations.delete('atlas-2026-10-11-mobile')
  result=service.load({clientId:'northstar',segment:'mobile'}); assert.ok(result.status==='found'); assert.equal(result.value.series.at(-1)?.values.mobile,null); assert.equal(result.value.comparisons[0].missingDays,1); assert.equal(result.value.comparisons[0].current,null)
  result=service.load({clientId:'northstar',segment:'desktop',dateRange:{from:'2026-10-05',to:'2026-10-05'}}); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].changePercent,null); assert.match(result.value.comparisons[0].explanation,/select two dates/)
})
test('empty measurements and unknown segments are valid empty selections, not seeded replacements', () => {
  const {database,service,data}=setup()
  const absent=service.load({clientId:'northstar',segment:'tablet'}); assert.ok(absent.status==='found'); assert.equal(absent.value.observations.length,0)
  database.writeCollection('usageObservations',[])
  const empty=service.load({clientId:'northstar'}); assert.ok(empty.status==='found'); assert.equal(empty.value.dateRange,null); assert.equal(empty.value.series.length,0); assert.equal(data.observations.list().length,0)
})
test('CRUD rejects invalid measurements, duplicate grains and cross-client ownership', () => {
  const {data}=setup(); const original=USAGE_DEMO.usageObservations[0]
  assert.equal(usageObservationSchema.safeParse({...original,sessions:-1}).success,false)
  assert.equal(usageObservationSchema.safeParse({...original,sessions:1.5}).success,false)
  assert.equal(data.observations.save({...original,clientId:'westbridge'}).ok,false)
  assert.equal(data.observations.save({...original,id:'duplicate'}).ok,false)
  assert.equal(data.releases.save({...USAGE_DEMO.usageReleases[0],projectId:'launch'}).ok,false)
})
test('malformed and duplicate saved usage collections remain invalid without overwrites', () => {
  const {database,service,values}=setup()
  database.writeCollection('usageObservations',[{id:'broken'}]); const before=values.get('orlo-browser-db-v1')
  assert.equal(service.load({clientId:'northstar'}).status,'invalid'); assert.equal(values.get('orlo-browser-db-v1'),before)
  const record=USAGE_DEMO.usageObservations[0]
  database.writeCollection('usageObservations',[record,{...record,id:'other'}]); assert.equal(service.load({clientId:'northstar'}).status,'invalid')
})
test('client aggregation sums projects only when coverage is complete and supports arbitrary segment names', () => {
  const {database,service}=setup()
  database.writeCollection('projects',[...ADAPTIVE_DEMO.projects,{id:'beta',name:'Beta',clientId:'northstar',description:''}])
  database.writeCollection('usageObservations',[
    {id:'a',clientId:'northstar',projectId:'atlas',date:'2026-10-05',segment:'tablet.web',sessions:10,source:'manual'},
    {id:'b',clientId:'northstar',projectId:'beta',date:'2026-10-05',segment:'tablet.web',sessions:20,source:'manual'},
    {id:'c',clientId:'northstar',projectId:'atlas',date:'2026-10-06',segment:'tablet.web',sessions:15,source:'manual'},
  ])
  let result=service.load({clientId:'northstar'}); assert.ok(result.status==='found'); assert.equal(result.value.series[0].values['tablet.web'],30); assert.equal(result.value.series[1].values['tablet.web'],null)
  result=service.load({clientId:'northstar',projectId:'atlas'}); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].changePercent,50)
})
test('saved edits survive reload and missing collection keys alone receive new fixtures', () => {
  const {data,service,storage,collections,values}=setup()
  data.observations.update('atlas-2026-10-11-mobile',{sessions:310})
  const reloaded=createBrowserDatabase(storage,{tasks:[],events:[],drafts:{},dismissed:[],activity:[]},collections)
  const result=createUsageInvestigationService(reloaded).load({clientId:'northstar',segment:'mobile'}); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].current,310)
  const raw=JSON.parse(values.get('orlo-browser-db-v1')!); raw.collections.usageObservations=[]; delete raw.collections.usageReleases
  values.set('orlo-browser-db-v1',JSON.stringify(raw))
  const migrated=createUsageDataService(createBrowserDatabase(storage,{tasks:[],events:[],drafts:{},dismissed:[],activity:[]},collections)); assert.equal(migrated.observations.list().length,0); assert.equal(migrated.releases.list().length,2)
  assert.equal(service.load({clientId:'northstar'}).status,'found')
})
test('collection notifications refresh usage results without domain mutations', () => {
  const {database,data,service}=setup(); const state=database.getState()
  const store=createRecordStore<UsageInvestigation>(database,()=>service.load({clientId:'northstar',segment:'mobile'}))
  const original=store.getSnapshot(); let updates=0; const unsubscribe=store.subscribe(()=>updates++)
  data.observations.update('atlas-2026-10-11-mobile',{sessions:100})
  assert.equal(updates,1); assert.notEqual(store.getSnapshot(),original); assert.equal(database.getState(),state)
  const result=store.getSnapshot(); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].current,100); unsubscribe()
})
test('intent adapter validates usage scope without hardcoded client/project IDs', () => {
  const {service}=setup()
  const result=service.loadIntent({goalType:'usage_investigation',clientId:'westbridge',projectId:'launch',dateRange:{from:'2026-10-05',to:'2026-10-11'}},'mobile')
  assert.ok(result.status==='found'); assert.equal(result.value.client?.name,'Westbridge'); assert.equal(result.value.comparisons[0].baseline,180)
  assert.equal(service.loadIntent({goalType:'overdue_review',projectId:'launch',dateRange:{from:'2026-10-05',to:'2026-10-11'}}).status,'invalid')
})

test('blocked storage keeps accepted usage edits usable in memory', () => {
  const storage=createBrowserStorage(()=>{throw Error('blocked')})
  const database=createBrowserDatabase(storage,{tasks:[],events:[],drafts:{},dismissed:[],activity:[]},{...ADAPTIVE_DEMO,...USAGE_DEMO})
  const data=createUsageDataService(database), service=createUsageInvestigationService(database)
  assert.ok(data.observations.update('atlas-2026-10-11-mobile',{sessions:250}).ok)
  const result=service.load({clientId:'northstar',segment:'mobile'}); assert.ok(result.status==='found'); assert.equal(result.value.comparisons[0].current,250)
  assert.equal(database.getPersistenceResult().status,'unavailable')
})

test('comparable periods use equal windows, exclude odd middle days and reject missing coverage', () => {
  const {service,data}=setup()
  const result=service.load({clientId:'northstar',projectId:'atlas',segment:'mobile',dateRange:{from:'2026-10-05',to:'2026-10-11'}})
  assert.ok(result.status==='found')
  const comparison=result.value.periodComparisons[0]
  assert.deepEqual(comparison.baselineRange,{from:'2026-10-05',to:'2026-10-07'})
  assert.deepEqual(comparison.currentRange,{from:'2026-10-09',to:'2026-10-11'})
  const avg=(from:string,to:string)=>result.value.observations.filter(r=>r.date>=from&&r.date<=to).reduce((sum,r)=>sum+r.sessions/3,0)
  assert.equal(comparison.baselineAverage,avg('2026-10-05','2026-10-07'))
  assert.equal(comparison.currentAverage,avg('2026-10-09','2026-10-11'))
  assert.match(comparison.explanation,/middle day excluded/)
  data.observations.delete('atlas-2026-10-09-mobile')
  const missing=service.load({clientId:'northstar',segment:'mobile',dateRange:{from:'2026-10-05',to:'2026-10-11'}})
  assert.ok(missing.status==='found'); assert.equal(missing.value.periodComparisons[0].currentAverage,null); assert.equal(missing.value.periodComparisons[0].changePercent,null)
})
