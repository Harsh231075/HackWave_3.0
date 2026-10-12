import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createUsageWorkspaceService } from '../client/src/services/usageWorkspaceService.ts'
import { validateUsageComposition,usageDraftKey,type UsageComposition } from '../client/src/domain/usageComposition.ts'
test('usage retrieval selects only evidence-linked work and respects dates and segment',()=>{
 const {database}=localSetup(true),service=createUsageWorkspaceService(database),intent={goalType:'usage_investigation' as const,dateRange:{from:'2026-09-14',to:'2026-10-11'},constraints:{segment:'mobile'}}
 const result=service.load(intent);assert.equal(result.status,'found');if(result.status!=='found')return
 assert.equal(result.value.snapshot.tasks.length,1);assert.equal(result.value.snapshot.resources.length,1);assert.equal(result.value.snapshot.issues.length,1);assert.equal(result.value.snapshot.communications.length,0)
 assert.equal(result.value.snapshot.releases[0].title,'Onboarding update');assert.equal(result.value.snapshot.observations.length,28)
 const plan:UsageComposition={version:2,requestId:'r',widgets:(['context','usage','outline'] as const).map(type=>({type,span:'full',reason:'Measurements support this investigation.',evidence:[{kind:'release',id:result.value.releases[0].id}]}))}
 const request={version:2 as const,kind:'usage' as const,requestId:'r',intent,snapshot:result.value.snapshot,draft:''};assert.equal(validateUsageComposition(plan,request).success,true)
 assert.equal(validateUsageComposition({...plan,widgets:plan.widgets.map(w=>({...w,evidence:[{kind:'task',id:'missing'}]}))},request).success,false)
 assert.notEqual(usageDraftKey(intent),usageDraftKey({...intent,constraints:{segment:'web'}}))
})
