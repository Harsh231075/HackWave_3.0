import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { Resource } from '../domain/types.ts'
import { createResourceService } from './resourceService.ts'
import { createFileService } from './fileService.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
const linkSchema=z.object({kind:z.enum(['task','meeting']),id:z.string().min(1)})
export const resourcePropertiesSchema=z.object({description:z.string().max(2000).default(''),tags:z.array(z.string().trim().min(1).max(40)).max(20).default([]),links:linkSchema.array().max(50).default([])})
export const resourceDraftInputSchema=z.object({title:z.string().max(160),kind:z.string().trim().min(1).max(80),context:z.string().max(200),body:z.string().max(5000),...resourcePropertiesSchema.shape})
export const resourceInputSchema=resourceDraftInputSchema.extend({title:z.string().trim().min(1).max(160)}).superRefine((r,ctx)=>{if(r.kind==='link'){try{const url=new URL(r.body);if(!['http:','https:'].includes(url.protocol))throw new Error()}catch{ctx.addIssue({code:'custom',path:['body'],message:'Enter a valid HTTP or HTTPS URL.'})}}})
export type ResourceInput=z.infer<typeof resourceInputSchema>
export type ResourceProperties=z.infer<typeof resourcePropertiesSchema>
export function createResourceModuleService(database:BrowserDatabase,seeds:readonly Resource[]=[]){
 const resources=createResourceService(seeds,database),files=createFileService(database),adaptive=createAdaptiveDataService(database)
 const properties=()=>{const loaded=database.readCollection('resourceProperties');if(loaded.status==='missing')return {};const parsed=z.record(z.string(),resourcePropertiesSchema).safeParse(loaded.status==='found'?loaded.value:null);return parsed.success?parsed.data:null}
 const props=(id:string)=>{const stored=properties()?.[id]??resourcePropertiesSchema.parse({});const existing=adaptive.snapshot()?.relationships.filter(l=>l.targetKind==='resource'&&l.targetId===id&&(l.sourceKind==='meeting'||l.sourceKind==='task')).map(l=>({kind:l.sourceKind as 'task'|'meeting',id:l.sourceId}))??[];return {...stored,links:[...stored.links,...existing.filter(l=>!stored.links.some(s=>s.kind===l.kind&&s.id===l.id))]}}
 const linkValid=(link:ResourceProperties['links'][number])=>link.kind==='task'?database.getState().tasks.some(t=>t.id===link.id):database.getState().events.some(e=>e.id===link.id)||adaptive.meetings.getById(link.id)!==null
 return {resources,files,properties:props,
 save(input:ResourceInput,id?:string,expected?:{record:Resource;properties:ResourceProperties}){
  const parsed=resourceInputSchema.safeParse(input)
  if(!parsed.success)return {ok:false as const,message:parsed.error.issues[0].message}
  const map=properties();if(!map)return {ok:false as const,message:'Saved resource properties are invalid and have been preserved.'}
  if(parsed.data.links.some(l=>!linkValid(l)))return {ok:false as const,message:'A linked record is no longer available. Choose its replacement.'}
  if(id&&(!expected||JSON.stringify(resources.getById(id))!==JSON.stringify(expected.record)||JSON.stringify(props(id))!==JSON.stringify(expected.properties)))return {ok:false as const,message:'This resource changed. Reopen it before saving.'}
  if(input.kind==='attachment'&&(!input.body.startsWith('file:')||!files.list().some(f=>f.id===input.body.slice(5))))return {ok:false as const,message:'Choose an available attachment.'}
  return database.transaction(()=>{
   const {description,tags,links,...record}=parsed.data
   const saved=id?resources.update(id,record):resources.create(record);if(!saved.ok)return saved
   const metadata=database.writeCollection('resourceProperties',{...map,[saved.value.id]:{description,tags:[...new Set(tags)],links}})
   if(metadata.status==='invalid')return {ok:false as const,message:'Unable to save resource properties.'}
   const snapshot=adaptive.snapshot();if(!snapshot&&links.some(l=>l.kind!=='task'))return {ok:false as const,message:'Linked context is unavailable.'}
   for(const link of snapshot?.relationships.filter(l=>l.targetKind==='resource'&&l.targetId===saved.value.id)??[]){const matches=links.some(l=>l.kind===link.sourceKind&&l.id===link.sourceId);if(!matches){const removed=adaptive.relationships.delete(link.id);if(!removed.ok)return removed}}
   for(const link of links){
    // Local events without a preparation record still retain their link in metadata.
    if(link.kind==='meeting'&&!adaptive.meetings.getById(link.id))continue
    if(snapshot?.relationships.some(l=>l.sourceKind===link.kind&&l.sourceId===link.id&&l.targetKind==='resource'&&l.targetId===saved.value.id))continue
    const relation=adaptive.relationships.create({sourceKind:link.kind as 'task'|'meeting',sourceId:link.id,targetKind:'resource',targetId:saved.value.id,type:'related'})
    if(!relation.ok)return relation
   }
   return {ok:true as const,value:saved.value}
  })
 },
 delete(id:string,expected:Resource){
  if(JSON.stringify(resources.getById(id))!==JSON.stringify(expected))return {ok:false as const,message:'This resource changed. Reopen it before deleting.'}
  const map=properties();if(!map)return {ok:false as const,message:'Saved properties are invalid and have been preserved.'}
  return database.transaction(()=>{
   const snapshot=adaptive.snapshot();if(!snapshot)return {ok:false as const,message:'Resource links are unavailable. Restore them before deleting.'}
   for(const link of snapshot.relationships.filter(l=>l.targetKind==='resource'&&l.targetId===id&&(l.sourceKind==='meeting'||l.sourceKind==='task'))){const removed=adaptive.relationships.delete(link.id);if(!removed.ok)return removed}
   const removed=resources.delete(id);if(!removed.ok)return removed
   const next={...map};delete next[id];if(database.writeCollection('resourceProperties',next).status==='invalid')return {ok:false as const,message:'Unable to remove resource properties.'}
   return {ok:true as const,value:undefined}
  })
 },
 loadDraft(key:string){const loaded=database.readCollection('resourceDrafts');return loaded.status==='found'&&loaded.value&&typeof loaded.value==='object'?(loaded.value as Record<string,unknown>)[key]:undefined},
 saveDraft(key:string,value:unknown){const loaded=database.readCollection('resourceDrafts');if(loaded.status==='invalid')return {status:'invalid' as const};return database.writeCollection('resourceDrafts',{...(loaded.status==='found'?loaded.value as object:{}),[key]:value})},
 }
}
