import { Mongoose, Schema, type SchemaDefinition } from 'mongoose'
import { z } from 'zod'
import { entityContracts, parseEntity, type EntityType } from './contracts.ts'

// Models share this instance; connectLocalMongo opens the connection only when the API starts.
export const mongoose = new Mongoose()
const names = {tasks:'Task',events:'Event',notes:'Note',resources:'Resource',attachments:'Attachment',links:'RecordLink',issues:'Issue',communications:'Communication','usage-observations':'UsageObservation','usage-releases':'UsageRelease','plugin-settings':'PluginSettings','voice-notes':'VoiceNote',workspaces:'Workspace',activity:'Activity'} as const

// API and model field definitions share the Zod contract; nested JSON is checked by the validation hook.
export const modelSchemas = Object.fromEntries(Object.entries(entityContracts).map(([entity, contract]) => {
  const json=z.toJSONSchema(contract) as {properties:Record<string,{type?:string;enum?:unknown[];minimum?:number;maximum?:number;maxLength?:number;default?:unknown}>;required?:string[]}
  const fields:SchemaDefinition={id:{type:String,required:true,unique:true},revision:{type:Number,required:true,min:1,validate:Number.isInteger},createdAt:{type:Date,required:true},updatedAt:{type:Date,required:true}}
  for(const [key, property] of Object.entries(json.properties)) {
    fields[key]={type:property.type==='string'?String:property.type==='number'||property.type==='integer'?Number:property.type==='boolean'?Boolean:Schema.Types.Mixed,required:json.required?.includes(key)??false,...(property.enum?{enum:property.enum}:{}),...(property.minimum!==undefined?{min:property.minimum}:{}),...(property.maximum!==undefined?{max:property.maximum}:{}),...(property.maxLength!==undefined?{maxlength:property.maxLength}:{}),...(property.default!==undefined?{default:()=>structuredClone(property.default)}:{})}
  }
  const schema=new Schema(fields,{collection:entity,strict:'throw',bufferCommands:false,autoCreate:false,autoIndex:false,versionKey:false})
  schema.pre('validate',function(){
    const object=this.toObject();const {_id,id,revision,createdAt,updatedAt,...payload}=object;void _id;void id;void revision;void createdAt;void updatedAt
    try{parseEntity(entity as EntityType,payload)}catch(failure){this.invalidate('payload',failure instanceof Error?failure.message:'Invalid record.')}
  })
  if(entity==='tasks')schema.index({status:1,due:1})
  if(entity==='events')schema.index({date:1,start:1})
  if(entity==='usage-observations')schema.index({date:1,segment:1},{unique:true})
  if(entity==='plugin-settings')schema.index({pluginId:1},{unique:true})
  if(entity==='links')schema.index({sourceType:1,sourceId:1,targetType:1,targetId:1},{unique:true})
  return [entity,schema]
})) as Record<EntityType,Schema>
export const mongoModels=Object.fromEntries(Object.entries(modelSchemas).map(([entity,schema])=>[entity,mongoose.model(names[entity as EntityType],schema)]))
export const mongoConnectionState=()=>mongoose.connection.readyState
