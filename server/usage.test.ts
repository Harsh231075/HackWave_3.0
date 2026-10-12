import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createUsageDataService } from '../client/src/services/usageDataService.ts'
import { createUsageInvestigationService } from '../client/src/services/usageInvestigationService.ts'
test('usage is derived by date/segment, editable and unique per date/segment',()=>{
 const {database}=localSetup(true),data=createUsageDataService(database),service=createUsageInvestigationService(database)
 const query={dateRange:{from:'2026-09-14',to:'2026-10-11'},segment:'mobile'},first=service.load(query);assert.equal(first.status,'found');if(first.status!=='found')return
 assert.equal(first.value.observations.length,28);assert.equal(first.value.releases.length,1);assert.equal(first.value.periodComparisons.length,1);assert.ok(first.value.periodComparisons[0].changePercent!<0)
 const row=first.value.observations[0];assert.ok(data.observations.update(row.id,{sessions:500}).ok);const changed=service.load(query);if(changed.status==='found')assert.equal(changed.value.comparisons[0].baseline,500)
 assert.equal(data.observations.create({...row,id:undefined} as never).ok,false)
})
test('missing measurements stay unknown and equal period comparisons avoid fabricated totals',()=>{
 const {database}=localSetup(),data=createUsageDataService(database),service=createUsageInvestigationService(database)
 assert.ok(data.observations.create({date:'2026-10-01',segment:'web',sessions:10,source:'manual'}).ok)
 const result=service.load({dateRange:{from:'2026-10-01',to:'2026-10-04'},segment:'web'});assert.equal(result.status,'found');if(result.status==='found'){assert.equal(result.value.comparisons[0].current,null);assert.equal(result.value.comparisons[0].missingDays,3);assert.equal(result.value.periodComparisons[0].currentAverage,null);assert.equal(result.value.series[1].values.web,null)}
})
test('atomic imports reject duplicates, invalid dates and malformed collections',()=>{
 const {database}=localSetup(),service=createUsageDataService(database),row={date:'2026-10-11',segment:'web',sessions:25}
 assert.equal(service.importObservations([row,row]).ok,false);assert.equal(service.observations.list().length,0);assert.equal(service.importObservations([{...row,date:'bad'}]).ok,false)
 assert.equal(service.importObservations([row]).ok,true);assert.equal(service.importObservations([row]).ok,false)
 database.writeCollection('usageObservations',[{}]);assert.equal(service.snapshot(),null);assert.equal(service.importObservations([row]).ok,false)
})
test('empty usage remains empty and date windows are bounded',()=>{const service=createUsageInvestigationService(localSetup().database);const empty=service.load({});assert.equal(empty.status,'found');if(empty.status==='found')assert.equal(empty.value.observations.length,0);assert.equal(service.load({dateRange:{from:'2020-01-01',to:'2026-10-11'}}).status,'invalid')})
