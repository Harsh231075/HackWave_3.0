import { issueService, communicationService, resourceService, usageObservationService, usageReleaseService, relationshipService, browserDatabase, meetingService } from '@/services'
import type { RecordSpec, RecordField, ManagedRecord } from './RecordManager'
import type { ActionResult } from '@/domain/commands'
type Service<T extends {id:string}>={list:()=>T[];create:(input:Omit<T,'id'>)=>ActionResult<unknown> | Promise<ActionResult<unknown>>;update:(id:string,input:Partial<Omit<T,'id'>>)=>ActionResult<unknown> | Promise<ActionResult<unknown>>;delete:(id:string)=>ActionResult<void> | Promise<ActionResult<void>>}
function spec<T extends {id:string}>(title:string,fields:RecordField[],service:Service<T>):RecordSpec {return {title,fields,list:()=>service.list() as ManagedRecord[],create:value=>service.create(value as Omit<T,'id'>),update:(id,value)=>service.update(id,value as Partial<Omit<T,'id'>>),delete:service.delete}}
const field=(key:string,label:string,type:RecordField['type']='text',required=true):RecordField=>({key,label,type,required})
const meeting:RecordField={...field('meetingId','Meeting (optional)','select',false),options:()=>meetingService.list().map(m=>({value:m.id,label:m.title}))}
const date=field('date','Date','date')
const source:RecordField={...field('source','Source','select'),options:[{value:'manual',label:'Manual'},{value:'synthetic',label:'Synthetic'}]}
export const resourceSpec=spec('resources',[field('title','Title'),field('kind','Type'),field('context','Topic / context'),field('body','Content','textarea')],resourceService)
export const issueSpec=spec('issues',[meeting,field('title','Title'),field('description','Description','textarea'),field('owner','Owner'),{...field('status','Status','select'),options:[{value:'open',label:'Open'},{value:'closed',label:'Closed'}]}],issueService)
export const communicationSpec=spec('communication logs',[meeting,date,field('sender','Sender'),field('subject','Subject'),field('body','Message','textarea')],communicationService)
export const observationSpec=spec('usage measurements',[date,field('segment','Segment'),field('sessions','Sessions','number'),source],usageObservationService)
export const releaseSpec=spec('release records',[date,field('title','Title'),field('description','Description','textarea'),field('segments','Segments (comma separated)','array',false),source],usageReleaseService)
export const linkSpec=spec('record links',[
 {...field('sourceKind','Link from','select'),options:[{value:'meeting',label:'Meeting'}]},
 {...field('sourceId','Meeting','select'),options:()=>meetingService.list().map(m=>({value:m.id,label:m.title}))},
 {...field('targetKind','Record type','select'),options:[{value:'task',label:'Task'},{value:'resource',label:'Resource'},{value:'meeting',label:'Previous meeting'}]},
 {...field('targetId','Record','select'),options:v=>v.targetKind==='task'?browserDatabase.getState().tasks.map(t=>({value:t.id,label:t.title})):v.targetKind==='resource'?resourceService.list().map(r=>({value:r.id,label:r.title})):meetingService.list().map(m=>({value:m.id,label:m.title}))},
 {...field('type','Relationship','select'),options:[{value:'related',label:'Related task/resource'},{value:'previous_meeting',label:'Previous meeting'}]},
],relationshipService)
