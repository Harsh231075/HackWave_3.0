import { clientService, projectService, issueService, communicationService, resourceService, usageObservationService, usageReleaseService, relationshipService, browserDatabase, meetingService } from '@/services'
import type { RecordSpec, RecordField, ManagedRecord } from './RecordManager'
import type { ActionResult } from '@/domain/commands'
type Service<T extends {id:string}>={list:()=>T[];create:(input:Omit<T,'id'>)=>ActionResult<unknown>;update:(id:string,input:Partial<Omit<T,'id'>>)=>ActionResult<unknown>;delete:(id:string)=>ActionResult<void>}
function spec<T extends {id:string}>(title:string,fields:RecordField[],service:Service<T>):RecordSpec {return {title,fields,list:()=>service.list() as ManagedRecord[],create:value=>service.create(value as Omit<T,'id'>),update:(id,value)=>service.update(id,value as Partial<Omit<T,'id'>>),delete:service.delete}}
const field=(key:string,label:string,type:RecordField['type']='text',required=true):RecordField=>({key,label,type,required})
const client:RecordField={...field('clientId','Client','select'),options:()=>clientService.list().map(c=>({value:c.id,label:c.name}))}
const project:RecordField={...field('projectId','Project','select'),options:v=>projectService.list().filter(p=>!v.clientId||p.clientId===v.clientId).map(p=>({value:p.id,label:p.name}))}
const meeting:RecordField={...field('meetingId','Meeting (optional)','select',false),options:v=>meetingService.list().filter(m=>m.projectId===v.projectId).map(m=>({value:m.id,label:m.title}))}
const date=field('date','Date','date')
const source:RecordField={...field('source','Source','select'),options:[{value:'manual',label:'Manual'},{value:'synthetic',label:'Synthetic'}]}
export const clientSpec=spec('clients',[field('name','Name'),field('description','Description','textarea')],clientService)
export const projectSpec=spec('projects',[field('name','Name'),field('description','Description','textarea'),{...client,required:false}],projectService)
export const resourceSpec=spec('resources',[field('title','Title'),field('kind','Type'),field('context','Topic / context'),field('body','Content','textarea')],resourceService)
export const issueSpec=spec('issues',[client,project,meeting,field('title','Title'),field('description','Description','textarea'),field('owner','Owner'),{...field('status','Status','select'),options:[{value:'open',label:'Open'},{value:'closed',label:'Closed'}]}],issueService)
export const communicationSpec=spec('communication logs',[client,project,meeting,date,field('sender','Sender'),field('subject','Subject'),field('body','Message','textarea')],communicationService)
export const observationSpec=spec('usage measurements',[client,project,date,field('segment','Segment'),field('sessions','Sessions','number'),source],usageObservationService)
export const releaseSpec=spec('release records',[client,project,date,field('title','Title'),field('description','Description','textarea'),field('segments','Segments (comma separated)','array',false),source],usageReleaseService)
export const linkSpec=spec('record links',[
 {...field('sourceKind','Link from','select'),options:[{value:'project',label:'Project'},{value:'meeting',label:'Meeting'}]},
 {...field('sourceId','Project / meeting','select'),options:v=>(v.sourceKind==='meeting'?meetingService.list().map(m=>({value:m.id,label:m.title})):projectService.list().map(p=>({value:p.id,label:p.name})))},
 {...field('targetKind','Record type','select'),options:[{value:'task',label:'Task'},{value:'resource',label:'Resource'},{value:'meeting',label:'Previous meeting'}]},
 {...field('targetId','Record','select'),options:v=>v.targetKind==='task'?browserDatabase.getState().tasks.map(t=>({value:t.id,label:t.title})):v.targetKind==='resource'?resourceService.list().map(r=>({value:r.id,label:r.title})):meetingService.list().map(m=>({value:m.id,label:m.title}))},
 {...field('type','Relationship','select'),options:[{value:'related',label:'Related task/resource'},{value:'previous_meeting',label:'Previous meeting'}]},
],relationshipService)

const deleteClient=clientSpec.delete
autoGuard()
function autoGuard(){
 clientSpec.delete=id=>projectService.list().some(p=>p.clientId===id)?{ok:false,message:'Remove or reassign this client’s projects first.'}:deleteClient(id)
 const deleteProject=projectSpec.delete
 projectSpec.delete=id=>[...meetingService.list(),...issueService.list(),...communicationService.list(),...usageObservationService.list(),...usageReleaseService.list()].some(r=>r.projectId===id)||relationshipService.list().some(r=>r.sourceKind==='project'&&r.sourceId===id)?{ok:false,message:'Remove this project’s dependent records and links first.'}:deleteProject(id)
}
