import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { validateMeetingComposition,serializeMeetingComposition,type MeetingComposition } from '../src/domain/adaptiveData.ts'
import { createDraftService } from '../src/services/draftService.ts'
import { createLayoutService } from '../src/services/layoutService.ts'
import { emptyFilters } from '../src/domain/workspace.ts'
test('catalog and meeting preparation use actual direct links independently of task filters',()=>{
 const {database}=localSetup(true),service=createAdaptiveDataService(database),catalog=service.loadCandidates();assert.equal(catalog.status,'found');if(catalog.status!=='found')return
 assert.deepEqual(Object.keys(catalog.value),['meetings']);const meeting=catalog.value.meetings.find(m=>m.date==='2026-10-12')!
 database.dispatch({type:'filters',patch:{query:'nothing',status:'completed'}});const prepared=service.loadPreparation(meeting.id);assert.equal(prepared.status,'found');if(prepared.status!=='found')return
 assert.equal(prepared.value.tasks.length,3);assert.ok(prepared.value.tasks.every(t=>service.snapshot()!.relationships.some(l=>l.sourceKind==='meeting'&&l.sourceId===meeting.id&&l.targetId===t.id)))
 createDraftService(database).save('meeting-agenda:'+meeting.id,'Edited agenda');const edited=service.loadPreparation(meeting.id);assert.equal(edited.status,'found');if(edited.status==='found')assert.equal(edited.value.meeting.agenda,'Edited agenda')
})
test('record saves validate referenced meetings, releases and chronological history',()=>{
 const {database}=localSetup(true),service=createAdaptiveDataService(database),meetings=service.snapshot()!.meetings
 assert.equal(service.communications.create({meetingId:'missing',date:'2026-10-11',sender:'Me',subject:'Test',body:'Text'}).ok,false)
 assert.equal(service.relationships.create({sourceKind:'meeting',sourceId:meetings[0].id,targetKind:'task',targetId:'missing',type:'related'}).ok,false)
 assert.equal(service.relationships.create({sourceKind:'meeting',sourceId:meetings[0].id,targetKind:'meeting',targetId:meetings.at(-1)!.id,type:'previous_meeting'}).ok,false)
 assert.equal(service.relationships.create({sourceKind:'release',sourceId:'missing',targetKind:'task',targetId:database.getState().tasks[0].id,type:'related'}).ok,false)
})
test('composition rejects invented evidence and persists v3 layout with isolated filters',()=>{
 const {database,storage}=localSetup(true),service=createAdaptiveDataService(database),meeting=service.snapshot()!.meetings.at(-1)!,prep=service.loadPreparation(meeting.id);assert.equal(prep.status,'found');if(prep.status!=='found')return
 const intent={goalType:'meeting_preparation' as const,meetingId:meeting.id,dateRange:{from:meeting.date,to:meeting.date}},request={version:2 as const,requestId:'r',intent,preparation:prep.value,agenda:meeting.agenda}
 const composition:MeetingComposition={version:2,requestId:'r',widgets:(['context','outline','tasks'] as const).map(type=>({type,span:'full',reason:'Linked to this meeting.',evidence:[{kind:'meeting',id:meeting.id}]}))}
 assert.ok(validateMeetingComposition(composition,request).success);assert.equal(validateMeetingComposition({...composition,widgets:composition.widgets.map(w=>({...w,evidence:[{kind:'task',id:'invented'}]}))},request).success,false)
 const layout=createLayoutService(storage,()=>true);assert.equal(layout.saveMeeting({version:3,kind:'meeting',meetingId:meeting.id,intent,composition,response:serializeMeetingComposition(composition),taskFilters:{...emptyFilters(),status:'blocked'}}).status,'saved');const loaded=layout.loadSession();assert.equal(loaded.status,'found');if(loaded.status==='found'&&'taskFilters'in loaded.value)assert.equal(loaded.value.taskFilters.status,'blocked')
})
