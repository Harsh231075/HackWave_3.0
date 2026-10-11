import type { BrowserDatabase } from './browserDatabase.ts'
import { emptyRecords, freshLocalData } from './localDataService.ts'
import { calendarDate, shiftDate } from '../domain/calendar.ts'
import type { Task, Event } from '../domain/types.ts'
import { noteSchema, type NoteRecord } from '../domain/notes.ts'
import { meetingSchema, communicationSchema, issueSchema, relationshipSchema, adaptiveResourceSchema } from '../domain/adaptiveData.ts'
import { usageObservationSchema, usageReleaseSchema } from '../domain/usage.ts'
import { persistedSchema } from './workspaceService.ts'
export function createDemoSeedService(database:BrowserDatabase,today=()=>calendarDate(),uuid=()=>crypto.randomUUID()){
  return {seed(){
    const state=database.getState()
    for(const key of ['notes','meetings','resources','issues','communications','relationships','usageObservations','usageReleases','files','voiceNotes','timerSessions']){
      const loaded=database.readCollection(key)
      if(loaded.status==='invalid'||loaded.status==='found'&&Array.isArray(loaded.value)&&loaded.value.length)return {ok:false as const,message:'Reset local data before adding sample data.'}
    }
    if(state.tasks.length||state.events.length||Object.values(state.drafts).some(Boolean))return {ok:false as const,message:'Reset local data before adding sample data.'}
    const snapshot=emptyRecords(),date=today(),data:Record<string,unknown>=freshLocalData(),notes:NoteRecord[]=[],relationships:Array<Record<string,unknown>>=[]
    const addNote=(title:string,body:string,kind:NoteRecord['kind']='general',meetingId?:string,pinned=false)=>{
      const id=uuid(),key=meetingId?`meeting-agenda:${meetingId}`:`note:${id}`,now=new Date().toISOString()
      notes.push({id,title,kind,...(meetingId?{meetingId}:{}),draftKey:key,pinned,createdAt:now,updatedAt:now});snapshot.drafts[key]=body
    }
    const taskInputs:Array<[string,number,Task['status'],Task['priority']]>=[['Resolve launch blocker',-3,'blocked','urgent'],['Prepare review talking points',-2,'pending','high'],['Review mobile feedback',-1,'pending','high'],['Confirm delivery checklist',-4,'pending','medium'],['Verify release readiness',0,'pending','high'],['Check activation flow',1,'blocked','high'],['Summarize feedback',2,'pending','medium'],['Confirm approval',3,'blocked','medium'],['Update documentation',4,'pending','low'],['Review analytics',0,'pending','medium'],['Publish review brief',-5,'completed','low'],['Check baseline metrics',-6,'completed','medium']]
    snapshot.tasks=taskInputs.map(([title,offset,status,priority],i)=>({id:uuid(),title,description:`Follow up on ${title.toLowerCase()}.`,owner:i%2?'Alex Morgan':'Me',due:shiftDate(date,offset),duration:30+i%3*15,status,priority}))
    const meetings:Array<Record<string,unknown>>=[]
    const addEvent=(title:string,offset:number,start:string,end:string,category:Event['category'])=>{
      const id=uuid();snapshot.events.push({id,title,date:shiftDate(date,offset),start,end,category,participants:category==='meeting'?['Me','Alex Morgan']:[],agenda:''})
      if(category==='meeting'){
        const meetingId=uuid();meetings.push({id:meetingId,eventId:id,title,date:shiftDate(date,offset),start,end,participants:['Me','Alex Morgan'],agenda:''});addNote(title+' agenda','Review progress\nDiscuss blockers\nAgree on next steps','agenda',meetingId);return meetingId
      }
      return id
    }
    const previous=[addEvent('Previous website review',-7,'10:00','11:00','meeting'),addEvent('Previous onboarding review',-6,'14:00','15:00','meeting')]
    addEvent('Weekly check-in',0,'09:00','09:30','meeting')
    const upcoming=[addEvent('Website launch review',1,'10:00','11:00','meeting'),addEvent('Onboarding review',1,'15:00','16:00','meeting')]
    for(const [title,offset,start,end,category] of [['Focus: review readiness',0,'10:00','11:00','focus'],['Focus: summarize feedback',0,'15:00','15:45','focus'],['Focus: prepare talking points',1,'09:00','09:30','focus'],['Focus: documentation',2,'13:00','14:00','focus'],['Lunch',0,'12:30','13:00','break'],['Break',1,'12:30','13:00','break'],['Product learning',3,'11:00','12:00','class']] as const)addEvent(title,offset,start,end,category)
    const resources=Array.from({length:6},(_,i)=>({id:uuid(),title:['Launch brief','Release checklist','Website feedback','Onboarding guide','Activation feedback','Usage reference'][i],kind:'document',context:i<3?'launch':'onboarding',body:'Synthetic reference: verify the critical journey, discuss feedback, and confirm an owner for next steps.'}))
    const communications=upcoming.flatMap((meetingId,i)=>[-2,-1].map(offset=>({id:uuid(),meetingId,date:shiftDate(date,offset),sender:'Alex Morgan',subject:i?'Onboarding feedback':'Launch review priorities',body:'Please review the outstanding blocker and confirm next steps.'})))
    const issues=upcoming.flatMap((meetingId,i)=>[0,1].map(n=>({id:uuid(),meetingId,title:n?'Approval pending':i?'Activation friction':'Launch blocker',description:'Review the evidence before committing to the next release.',status:'open',owner:'Me'})))
    const link=(sourceKind:string,sourceId:string,targetKind:string,targetId:string,type='related')=>relationships.push({id:uuid(),sourceKind,sourceId,targetKind,targetId,type})
    upcoming.forEach((meetingId,i)=>{link('meeting',meetingId,'meeting',previous[i],'previous_meeting');snapshot.tasks.slice(i*3,i*3+3).forEach(t=>link('meeting',meetingId,'task',t.id));resources.slice(i*3,i*3+3).forEach(r=>link('meeting',meetingId,'resource',r.id))})
    snapshot.tasks.slice(0,4).forEach((t,i)=>link('task',t.id,'resource',resources[i].id))
    addNote('Review priorities','Discuss blockers first. Record decisions and owners.','general',undefined,true)
    addNote('Decisions','Confirm the release checklist and outstanding approval.')
    addNote('Follow-up ideas','Compare usage with the feedback before drawing conclusions.')
    const observations=Array.from({length:28},(_,i)=>['web','mobile'].map(segment=>({id:uuid(),date:shiftDate(date,i-27),segment,sessions:segment==='mobile'?(i<14?180:110)+i%5:240+i%7,source:'synthetic'}))).flat()
    const releases=[{id:uuid(),date:shiftDate(date,-13),title:'Onboarding update',description:'Synthetic release; timing alone does not establish causation.',segments:['mobile'],source:'synthetic'},{id:uuid(),date:shiftDate(date,-4),title:'Web navigation update',description:'Synthetic release record for comparison.',segments:['web'],source:'synthetic'}]
    releases.forEach((r,i)=>{link('release',r.id,'task',snapshot.tasks[i].id);link('release',r.id,'resource',resources[i].id);link('release',r.id,'issue',issues[i].id)})
    Object.assign(data,{notes,meetings,resources,communications,issues,relationships,usageObservations:observations,usageReleases:releases})
    const schemas={notes:noteSchema,meetings:meetingSchema,resources:adaptiveResourceSchema,communications:communicationSchema,issues:issueSchema,relationships:relationshipSchema,usageObservations:usageObservationSchema,usageReleases:usageReleaseSchema}
    if(!persistedSchema.safeParse(snapshot).success||Object.entries(schemas).some(([key,schema])=>!schema.array().safeParse(data[key]).success))return {ok:false as const,message:'Sample data failed validation. Nothing was installed.'}
    return database.transaction(()=>{
      const result=database.replaceRecords(snapshot);if(result.status==='invalid')return {ok:false as const,message:'Sample records could not be installed.'}
      for(const [key,value] of Object.entries(data))if(database.writeCollection(key,value).status==='invalid')return {ok:false as const,message:'Sample data could not be installed.'}
      return {ok:true as const,value:undefined}
    })
  }}
}
