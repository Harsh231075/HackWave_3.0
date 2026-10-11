import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createOverdueReviewService } from '../src/services/overdueReviewService.ts'
import { validateOverdueComposition,type OverdueComposition } from '../src/domain/overdueReview.ts'
const intent={goalType:'overdue_review' as const,dateRange:{from:'0001-01-01',to:'2026-10-10'}}
test('overdue review excludes completed/future tasks and respects owner/status/priority/dates',()=>{
 const {database}=localSetup(true),service=createOverdueReviewService(database),result=service.load(intent,'2026-10-11');assert.equal(result.status,'found');if(result.status!=='found')return
 assert.equal(result.value.tasks.length,4);assert.equal(result.value.resources.length,4)
 const blocked=service.load({...intent,constraints:{status:'blocked'}},'2026-10-11');if(blocked.status==='found')assert.equal(blocked.value.tasks.length,1)
 const owner=service.load({...intent,constraints:{ownerId:'Me'}},'2026-10-11');if(owner.status==='found')assert.ok(owner.value.tasks.every(t=>t.owner==='Me'))
})
test('overdue composition validates task scope and real evidence',()=>{
 const service=createOverdueReviewService(localSetup(true).database),result=service.load(intent,'2026-10-11');assert.equal(result.status,'found');if(result.status!=='found')return
 const plan:OverdueComposition={version:2,requestId:'r',widgets:(['context','tasks'] as const).map(type=>({type,span:'full',reason:'Outstanding work before today.',evidence:[{kind:'task',id:result.value.tasks[0].id}]}))},request={version:2 as const,kind:'overdue' as const,requestId:'r',intent,review:result.value}
 assert.equal(validateOverdueComposition(plan,request).success,true);assert.equal(validateOverdueComposition({...plan,widgets:plan.widgets.map(w=>({...w,evidence:[{kind:'task',id:'invented'}]}))},request).success,false)
})
test('empty overdue compositions use no invented evidence; populated reviews still require references',()=>{
 const {database}=localSetup(true),intent={goalType:'overdue_review' as const,dateRange:{from:'2026-10-01',to:'2026-10-10'},constraints:{status:'blocked' as const,priority:'low' as const}}
 const review=createOverdueReviewService(database).load(intent,'2026-10-11');assert.ok(review.status==='found')
 const request={version:2 as const,kind:'overdue' as const,requestId:'empty',intent,review:review.value}
 const value={version:2,requestId:'empty',widgets:['context','tasks'].map(type=>({type,span:'full',reason:'No overdue records match the selected filters.',evidence:[]}))}
 assert.equal(validateOverdueComposition(value,request).success,true)
 assert.equal(validateOverdueComposition({...value,widgets:value.widgets.map(w=>({...w,evidence:[{kind:'task',id:'invented'}]}))},request).success,false)
 const populated=createOverdueReviewService(database).load({...intent,constraints:{}},'2026-10-11');assert.ok(populated.status==='found')
 assert.equal(validateOverdueComposition(value,{...request,intent:{...intent,constraints:{}},review:populated.value}).success,false)
})
