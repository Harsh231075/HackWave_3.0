import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createLocalDataService,legacyDataKeys } from '../src/services/localDataService.ts'
import { createDemoSeedService } from '../src/services/demoSeedService.ts'
import { createExtensionService } from '../src/extensions/extensionService.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { createUsageDataService } from '../src/services/usageDataService.ts'
test('fresh initialization awaits audio cleanup, clears owned legacy data and preserves OAuth/unrelated keys',async()=>{
 const {database,raw}=localSetup();for(const key of legacyDataKeys)raw.set(key,'old');raw.set('google-oauth','secret');raw.set('another-app','keep')
 let release:()=>void=()=>{},cleared=false;const service=createLocalDataService(database,()=>new Promise<void>(resolve=>{release=()=>{cleared=true;resolve()}}))
 const pending=service.initialize();assert.equal(service.getSnapshot().status,'loading');assert.equal(raw.has('orlo-data-v2'),false);release();assert.equal((await pending).ok,true);assert.equal(cleared,true)
 for(const key of legacyDataKeys)assert.equal(raw.has(key),false)
 assert.equal(raw.get('google-oauth'),'secret');assert.equal(raw.get('another-app'),'keep');assert.equal(database.getState().tasks.length,0);assert.deepEqual(createExtensionService(database).getSettings().enabled,[])
 const reloaded=createLocalDataService(database,async()=>{throw new Error('must not clean again')});assert.equal((await reloaded.initialize()).ok,true)
})
test('failed audio cleanup is retryable and does not complete initialization',async()=>{
 const {database,raw}=localSetup();let attempts=0;const service=createLocalDataService(database,async()=>{if(!attempts++)throw new Error('Blocked audio')})
 assert.equal((await service.initialize()).ok,false);assert.equal(service.getSnapshot().status,'error');assert.equal(raw.has('orlo-data-v2'),false);assert.equal((await service.initialize()).ok,true)
})
test('corrupt new storage is preserved until explicit reset',async()=>{
 const {database,raw}=localSetup();raw.set('orlo-data-v2','{');const service=createLocalDataService(database,async()=>{})
 assert.equal((await service.initialize()).ok,false);assert.equal(raw.get('orlo-data-v2'),'{');assert.equal((await service.reset()).ok,true);assert.equal(database.getState().tasks.length,0)
})
test('explicit sample data has complete direct links, relative dates and no organizations or fake activity',()=>{
 const {database}=localSetup();const extensions=createExtensionService(database);extensions.setEnabled('calculator',true)
 const seed=createDemoSeedService(database,()=> '2026-10-11');assert.equal(seed.seed().ok,true);assert.equal(seed.seed().ok,false)
 const state=database.getState();assert.equal(state.tasks.length,12);assert.equal(state.events.length,12);assert.equal(state.tasks.filter(t=>t.status!=='completed'&&t.due<'2026-10-11').length,4)
 const adaptive=createAdaptiveDataService(database),data=adaptive.snapshot()!;assert.equal(data.meetings.length,5);assert.equal(data.meetings.filter(m=>m.date==='2026-10-12').length,2);assert.equal(data.resources.length,6);assert.equal(data.communications.length,4);assert.equal(data.issues.length,4)
 const usage=createUsageDataService(database).snapshot()!;assert.equal(usage.observations.length,56);assert.equal(usage.releases.length,2)
 const notes=database.readCollection('notes');assert.equal(notes.status,'found');if(notes.status==='found')assert.equal((notes.value as unknown[]).length,8)
 assert.deepEqual(extensions.getSettings().enabled,['calculator']);assert.equal(database.readCollection('recordActivity').status,'found')
 assert.equal(JSON.stringify({state,data,usage}).includes('projectId'),false);assert.equal(JSON.stringify({state,data,usage}).includes('clientId'),false)
 for(const meeting of data.meetings.filter(m=>m.date==='2026-10-12')){const prep=adaptive.loadPreparation(meeting.id);assert.equal(prep.status,'found');if(prep.status==='found'){assert.equal(prep.value.tasks.length,3);assert.equal(prep.value.resources.length,3);assert.equal(prep.value.communications.length,2);assert.equal(prep.value.issues.length,2);assert.ok(prep.value.previousMeeting)}}
})
test('malformed new collection records block initialization and reset also clears current layout preferences',async()=>{
 const {database,raw}=localSetup();const service=createLocalDataService(database,async()=>{})
 assert.equal((await service.initialize()).ok,true)
 const saved=JSON.parse(raw.get('orlo-browser-db-v2')!);saved.collections.notes=[{id:'bad',projectId:'old'}];raw.set('orlo-browser-db-v2',JSON.stringify(saved))
 const next=createLocalDataService(database,async()=>{});assert.equal((await next.initialize()).ok,false)
 raw.set('orlo-layout-v3','old');raw.set('calendar-view','week');assert.equal((await next.reset()).ok,true);assert.equal(raw.has('orlo-layout-v3'),false);assert.equal(raw.has('calendar-view'),false)
})
test('concurrent reset requests await one audio cleanup before creating a fresh canvas',async()=>{
 const {database}=localSetup(true);let release=()=>{},cleans=0,canvasReady=false
 const service=createLocalDataService(database,()=>{cleans++;return new Promise<void>(resolve=>{release=resolve})},()=>{},()=>{canvasReady=true;assert.equal(database.getState().tasks.length,0)})
 const first=service.reset(),second=service.reset();assert.equal(first,second);assert.equal(cleans,1);assert.equal(canvasReady,false)
 release();assert.equal((await first).ok,true);assert.equal(canvasReady,true);assert.equal(service.getSnapshot().status,'ready')
})
