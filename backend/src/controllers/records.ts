import { z } from 'zod'
import { parseEntity, type EntityType, type RecordData, type StoredRecord } from '../models/contracts.ts'
import type { RecordRepository } from '../repositories/mongo.ts'
import { ApiError } from '../errors.ts'
export const listQuerySchema=z.strictObject({limit:z.coerce.number().int().min(1).max(100).default(25),offset:z.coerce.number().int().min(0).max(1000).default(0),q:z.string().max(160).optional(),status:z.string().max(30).optional(),owner:z.string().max(160).optional(),from:z.iso.date().optional(),to:z.iso.date().optional()}).refine(query=>!query.from||!query.to||query.from<=query.to,'Dates must be ordered.')
function dataOf(record:StoredRecord){const {id,revision,createdAt,updatedAt,...data}=record;void id;void revision;void createdAt;void updatedAt;return data}
export function createRecordController(repository:RecordRepository){
  const validate=(entity:EntityType,value:unknown)=>{try{return parseEntity(entity,value)}catch(error){if(error instanceof z.ZodError)throw error;throw new ApiError(422,'validation_error',error instanceof Error?error.message:'Invalid record.')}}
  const references=async(entity:EntityType,data:RecordData)=>{
    if(['notes','issues','communications'].includes(entity)&&data.meetingId)await repository.get('events',String(data.meetingId))
    if(entity==='voice-notes'){await repository.get('notes',String(data.noteId));await repository.get('attachments',String(data.attachmentId))}
    if(entity==='links'){await repository.get(data.sourceType as EntityType,String(data.sourceId));await repository.get(data.targetType as EntityType,String(data.targetId));if(data.sourceType===data.targetType&&data.sourceId===data.targetId)throw new ApiError(422,'validation_error','A record cannot link to itself.')}
  }
  return {
    async list(entity:EntityType,query:unknown){
      const filters=listQuerySchema.parse(query),search=filters.q?.toLocaleLowerCase()
      const records=(await repository.list(entity)).filter(record=>(!search||[record.title,record.subject,record.body,record.description].some(value=>typeof value==='string'&&value.toLocaleLowerCase().includes(search)))&&(!filters.status||record.status===filters.status)&&(!filters.owner||record.owner===filters.owner)&&(!filters.from||String(record.date??record.due??'')>=filters.from)&&(!filters.to||String(record.date??record.due??'')<=filters.to))
      return {data:records.slice(filters.offset,filters.offset+filters.limit),pagination:{total:records.length,limit:filters.limit,offset:filters.offset},boundedAt:1000}
    },
    get:(entity:EntityType,id:string)=>repository.get(entity,id),
    async create(entity:EntityType,value:unknown){const data=validate(entity,value);await references(entity,data);return repository.create(entity,data)},
    async update(entity:EntityType,id:string,patch:unknown,revision:number){
      if(!patch||typeof patch!=='object'||Array.isArray(patch)||!Object.keys(patch).length)throw new ApiError(422,'validation_error','Provide a non-empty JSON object.')
      const previous=await repository.get(entity,id)
      if(previous.revision!==revision)throw new ApiError(409,'revision_conflict','This record changed. Fetch it again before editing.')
      const data=validate(entity,{...dataOf(previous),...patch});await references(entity,data);return repository.update(entity,id,data,revision)
    },
    async delete(entity:EntityType,id:string,revision:number){
      // Keep linked records intact instead of silently deleting related information.
      const links=await repository.list('links')
      if(links.some(link=>link.sourceType===entity&&link.sourceId===id||link.targetType===entity&&link.targetId===id))throw new ApiError(409,'linked_record','Remove this record’s links before deleting it.')
      if(entity==='events')for(const type of ['notes','issues','communications'] as const){if((await repository.list(type)).some(record=>record.meetingId===id))throw new ApiError(409,'linked_record','Remove meeting references before deleting this event.')}
      if(entity==='notes'||entity==='attachments'){if((await repository.list('voice-notes')).some(record=>record[entity==='notes'?'noteId':'attachmentId']===id))throw new ApiError(409,'linked_record','Delete the voice-note reference first.')}
      await repository.delete(entity,id,revision)
    },
  }
}
