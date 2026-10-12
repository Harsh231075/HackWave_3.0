import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { parseEntity, type EntityType, type RecordData } from '../models/contracts.ts'
import { mongoModels, mongoose } from '../models/index.ts'
const run=promisify(execFile)
const record=z.record(z.string(),z.unknown())
const exportSchema=z.object({snapshot:z.object({tasks:record.array(),events:record.array(),drafts:z.record(z.string(),z.string())}),collections:z.object({notes:record.array(),meetings:record.array(),resources:record.array(),issues:record.array(),communications:record.array(),relationships:record.array(),usageObservations:record.array(),usageReleases:record.array()})})
export interface SeedRecord {entity:EntityType;id:string;data:RecordData}
export async function buildFrontendSeed(date:string):Promise<SeedRecord[]>{
  z.iso.date().parse(date)
  const script=fileURLToPath(new URL('../../scripts/export-frontend-seed.mjs',import.meta.url))
  const result=await run(process.execPath,['--experimental-strip-types',script,date],{maxBuffer:2*1024*1024})
  const {snapshot,collections}=exportSchema.parse(JSON.parse(result.stdout))
  const meetingEvents=new Map(collections.meetings.map(meeting=>[String(meeting.id),String(meeting.eventId)]))
  const rows:SeedRecord[]=[]
  const add=(entity:EntityType,record:RecordData)=>{const {id,...data}=record;rows.push({entity,id:z.string().min(1).parse(id),data:parseEntity(entity,data)})}
  snapshot.tasks.forEach(record=>add('tasks',record))
  snapshot.events.forEach(record=>add('events',record))
  collections.notes.forEach(note=>add('notes',{id:note.id,title:note.title,body:snapshot.drafts[String(note.draftKey)]??'',kind:note.kind,pinned:note.pinned,...(note.meetingId?{meetingId:meetingEvents.get(String(note.meetingId))}: {})}))
  collections.resources.forEach(record=>add('resources',record))
  for(const entity of ['issues','communications'] as const)collections[entity].forEach(record=>add(entity,{...record,...(record.meetingId?{meetingId:meetingEvents.get(String(record.meetingId))}: {})}))
  collections.usageObservations.forEach(record=>add('usage-observations',record))
  collections.usageReleases.forEach(record=>add('usage-releases',record))
  const types:Record<string,EntityType>={task:'tasks',meeting:'events',resource:'resources',issue:'issues',communication:'communications',release:'usage-releases',observation:'usage-observations'}
  collections.relationships.forEach(link=>{
    const sourceType=types[String(link.sourceKind)],targetType=types[String(link.targetKind)]
    if(!sourceType||!targetType)throw new Error('Unknown frontend relationship type.')
    add('links',{id:link.id,sourceType,sourceId:sourceType==='events'?meetingEvents.get(String(link.sourceId)):link.sourceId,targetType,targetId:targetType==='events'?meetingEvents.get(String(link.targetId)):link.targetId,relationType:link.type})
  })
  const keys=new Set(rows.map(row=>`${row.entity}:${row.id}`))
  for(const row of rows){
    if(row.data.meetingId&&!keys.has(`events:${row.data.meetingId}`))throw new Error('Missing event reference in seed.')
    if(row.entity==='links'&&(!keys.has(`${row.data.sourceType}:${row.data.sourceId}`)||!keys.has(`${row.data.targetType}:${row.data.targetId}`)))throw new Error('Missing relationship reference in seed.')
  }
  return rows
}
export function localReferenceDate(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Calcutta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=(type:string)=>parts.find(p=>p.type===type)!.value;return `${get('year')}-${get('month')}-${get('day')}`}
export async function seedFrontendDemo(requestedDate?:string){
  if(mongoose.connection.readyState!==1)throw new Error('Connect to local MongoDB before seeding.')
  const metadata=mongoose.connection.collection('_seed_runs')
  const previous=await metadata.findOne({key:'frontend-demo-v1'})
  if(requestedDate&&previous&&previous.referenceDate!==requestedDate)throw new Error(`This seed already uses ${previous.referenceDate}. Existing records will not be overwritten.`)
  const date=String(previous?.referenceDate??requestedDate??localReferenceDate())
  const rows=await buildFrontendSeed(date)
  // Preserve the original anchor date so repeating the script later does not shift existing dates.
  await metadata.updateOne({key:'frontend-demo-v1'},{$setOnInsert:{key:'frontend-demo-v1',referenceDate:date,createdAt:new Date()}},{upsert:true})
  const counts:Record<string,{inserted:number;skipped:number}>={}
  for(const row of rows){
    counts[row.entity]??={inserted:0,skipped:0}
    if(await mongoModels[row.entity].exists({id:row.id})){counts[row.entity].skipped++;continue}
    if(row.entity==='usage-observations'&&await mongoModels[row.entity].exists({date:row.data.date,segment:row.data.segment})){counts[row.entity].skipped++;continue}
    const now=new Date(),document=new mongoModels[row.entity]({...row.data,id:row.id,revision:1,createdAt:now,updatedAt:now})
    await document.validate()
    try{const result=await mongoModels[row.entity].updateOne({id:row.id},{$setOnInsert:{...row.data,id:row.id,revision:1,createdAt:now,updatedAt:now}},{upsert:true,runValidators:true});counts[row.entity][result.upsertedCount?'inserted':'skipped']++}
    catch(error){if(error&&typeof error==='object'&&'code'in error&&error.code===11000){counts[row.entity].skipped++}else throw error}
  }
  return {database:mongoose.connection.name,referenceDate:date,source:'client/src/services/demoSeedService.ts',counts}
}
