import { randomUUID } from 'node:crypto'
import { mongoModels } from '../models/index.ts'
import { type EntityType, type RecordData, type StoredRecord } from '../models/contracts.ts'
import { ApiError } from '../errors.ts'
export interface RecordRepository {
  list(entity:EntityType):Promise<StoredRecord[]>
  get(entity:EntityType,id:string):Promise<StoredRecord>
  create(entity:EntityType,data:RecordData):Promise<StoredRecord>
  update(entity:EntityType,id:string,data:RecordData,expectedRevision:number):Promise<StoredRecord>
  delete(entity:EntityType,id:string,expectedRevision:number):Promise<void>
}
const serialize=(value:unknown):StoredRecord=>{
  const record=JSON.parse(JSON.stringify(value)) as RecordData
  delete record._id
  return record as StoredRecord
}
export function createMongoRepository():RecordRepository {
  const model=(entity:EntityType)=>mongoModels[entity]
  const get=async(entity:EntityType,id:string)=>{const value=await model(entity).findOne({id}).lean();if(!value)throw new ApiError(404,'not_found','Record not found.');return serialize(value)}
  const conflict=async(entity:EntityType,id:string)=>{await get(entity,id);throw new ApiError(409,'revision_conflict','This record changed. Fetch it again before updating or deleting.')}
  return {
    async list(entity){return (await model(entity).find().sort({createdAt:-1,id:1}).limit(1000).lean()).map(serialize)},
    get,
    async create(entity,data){const now=new Date();const record=await model(entity).create({...data,id:randomUUID(),revision:1,createdAt:now,updatedAt:now});return serialize(record.toObject())},
    async update(entity,id,data,revision){
      // A compare-and-swap query prevents two requests from overwriting each other.
      const record=await model(entity).findOneAndUpdate({id,revision},{$set:{...data,updatedAt:new Date()},$inc:{revision:1}},{new:true,runValidators:true}).lean()
      if(!record)return conflict(entity,id)
      return serialize(record)
    },
    async delete(entity,id,revision){const result=await model(entity).deleteOne({id,revision});if(!result.deletedCount)await conflict(entity,id)},
  }
}
