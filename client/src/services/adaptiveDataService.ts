import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import { createCollection } from './local/collection.ts'
import { meetingSchema, communicationSchema, issueSchema, relationshipSchema, adaptiveResourceSchema, preparationSchema, type Preparation } from '../domain/adaptiveData.ts'
import { intentCandidatesSchema, type IntentCandidates } from '../domain/intent.ts'
function read<T>(database: BrowserDatabase,key:string,schema:z.ZodType<T>):T[]|null{
  const loaded=database.readCollection(key)
  if(loaded.status==='missing')return []
  if(loaded.status!=='found')return null
  const parsed=schema.array().safeParse(loaded.value)
  return parsed.success&&new Set(parsed.data.map(item=>(item as {id:string}).id)).size===parsed.data.length?parsed.data:null
}
export function createAdaptiveDataService(database:BrowserDatabase){
  function snapshot(){
    const meetings=read(database,'meetings',meetingSchema),communications=read(database,'communications',communicationSchema),issues=read(database,'issues',issueSchema),relationships=read(database,'relationships',relationshipSchema),resources=read(database,'resources',adaptiveResourceSchema)
    if(!meetings||!communications||!issues||!relationships||!resources)return null
    const state=database.getState()
    const effective=meetings.flatMap(meeting=>{
      const event=meeting.eventId?state.events.find(e=>e.id===meeting.eventId&&e.category==='meeting'):null
      if(meeting.eventId&&!event)return []
      const parsed=meetingSchema.safeParse({...meeting,...(event?{title:event.title,date:event.date,start:event.start,end:event.end,participants:event.participants}:{}),agenda:state.drafts[`meeting-agenda:${meeting.id}`]??meeting.agenda})
      return parsed.success?[parsed.data]:[]
    })
    return {meetings:effective,communications,issues,relationships,resources,tasks:state.tasks}
  }
  function collection<T extends {id:string}>(key:string,schema:z.ZodType<T>,valid:(record:T)=>boolean){
    const base=createCollection(database,key,schema)
    const save=(input:T)=>{const parsed=schema.safeParse(input);return !parsed.success||!valid(parsed.data)?{ok:false as const,message:`Invalid ${key} record references.`}:base.save(parsed.data)}
    return {...base,save,create:(input:Omit<T,'id'>)=>save({...input,id:crypto.randomUUID()} as T),update:(id:string,patch:Partial<Omit<T,'id'>>)=>{const record=base.getById(id);return record?save({...record,...patch,id}):{ok:false as const,message:'This record is unavailable.'}}}
  }
  const meetingExists=(id?:string)=>!id||!!snapshot()?.meetings.some(m=>m.id===id)
  const meetings=collection('meetings',meetingSchema,m=>!m.eventId||database.getState().events.some(e=>e.id===m.eventId&&e.category==='meeting'))
  const communications=collection('communications',communicationSchema,r=>meetingExists(r.meetingId))
  const issues=collection('issues',issueSchema,r=>meetingExists(r.meetingId))
  const relationships=collection('relationships',relationshipSchema,link=>{
    const data=snapshot();if(!data)return false
    const sourceRecords=link.sourceKind==='meeting'?data.meetings:link.sourceKind==='task'?data.tasks:link.sourceKind==='resource'?data.resources:read(database,link.sourceKind==='release'?'usageReleases':'usageObservations',z.object({id:z.string()}))
    const targetRecords=link.targetKind==='task'?data.tasks:link.targetKind==='resource'?data.resources:link.targetKind==='meeting'?data.meetings:link.targetKind==='issue'?data.issues:data.communications
    if(!sourceRecords?.some(r=>r.id===link.sourceId)||!targetRecords.some(r=>r.id===link.targetId))return false
    if(link.type==='previous_meeting')return data.meetings.some(m=>m.id===link.targetId&&m.date<(data.meetings.find(m=>m.id===link.sourceId)?.date??''))
    return !(link.sourceKind===link.targetKind&&link.sourceId===link.targetId)
  })
  return {snapshot,meetings,communications,issues,relationships,
    loadCandidates():LoadResult<IntentCandidates>{const data=snapshot();if(!data)return {status:'invalid'};const parsed=intentCandidatesSchema.safeParse({meetings:data.meetings.map(m=>({id:m.id,label:`${m.title} · ${m.date} ${m.start}–${m.end}`,date:m.date}))});return parsed.success?{status:'found',value:parsed.data}:{status:'invalid'}},
    loadPreparation(meetingId:string):LoadResult<Preparation>{
      const data=snapshot();if(!data)return {status:'invalid'}
      const meeting=data.meetings.find(m=>m.id===meetingId);if(!meeting)return {status:'missing'}
      const links=data.relationships.filter(l=>l.sourceKind==='meeting'&&l.sourceId===meetingId)
      const selected=(kind:string,id:string)=>links.some(l=>l.type==='related'&&l.targetKind===kind&&l.targetId===id)
      const parsed=preparationSchema.safeParse({meeting,previousMeeting:data.meetings.filter(m=>m.date<meeting.date&&links.some(l=>l.type==='previous_meeting'&&l.targetId===m.id)).sort((a,b)=>b.date.localeCompare(a.date))[0]??null,tasks:data.tasks.filter(t=>selected('task',t.id)).slice(0,100),resources:data.resources.filter(r=>selected('resource',r.id)).slice(0,100),communications:data.communications.filter(r=>r.meetingId===meetingId&&r.date<=meeting.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10),issues:data.issues.filter(r=>r.meetingId===meetingId&&r.status==='open').slice(0,100),reasons:{tasks:'Tasks directly linked to this meeting.',resources:'Sources directly linked to this meeting.',communications:'Recent communications linked to this meeting.',issues:'Open issues linked to this meeting.'}})
      return parsed.success?{status:'found',value:parsed.data}:{status:'invalid'}
    }}
}
