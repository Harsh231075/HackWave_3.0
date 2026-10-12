import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { entityContracts, isEntityType } from '../models/contracts.ts'
import { mongoConnectionState } from '../models/index.ts'
import { createRecordController } from '../controllers/records.ts'
import { createMongoRepository, type RecordRepository } from '../repositories/mongo.ts'
import { ApiError } from '../errors.ts'
const base='/api/v1'
async function body(req:IncomingMessage){
  if(!req.headers['content-type']?.split(';')[0].trim().toLowerCase().includes('application/json'))throw new ApiError(415,'content_type','Use application/json.')
  let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>1024*1024)throw new ApiError(413,'body_too_large','JSON body must be under 1 MiB.')}
  try{return JSON.parse(raw)}catch{throw new ApiError(400,'invalid_json','Provide valid JSON.')}
}
function revision(req:IncomingMessage){const header=req.headers['if-match'];if(typeof header!=='string')throw new ApiError(428,'revision_required','Send If-Match with the current record revision.');const value=header.replace(/^"(\d+)"$/,'$1');if(!/^[1-9]\d*$/.test(value)||!Number.isSafeInteger(Number(value)))throw new ApiError(400,'revision_invalid','If-Match must be a positive integer revision.');return Number(value)}
export function createApiHandler(repository:RecordRepository=createMongoRepository()){
  const controller=createRecordController(repository)
  return async(req:IncomingMessage,res:ServerResponse)=>{
    const send=(status:number,value?:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(value===undefined?undefined:JSON.stringify(value))}
    try{
      const url=new URL(req.url??'/','http://localhost'),parts=url.pathname.slice(base.length).split('/').filter(Boolean)
      if(!url.pathname.startsWith(base+'/'))throw new ApiError(404,'route_not_found','API route not found.')
      if(parts.length===1&&parts[0]==='health'){if(req.method!=='GET')throw new ApiError(405,'method_not_allowed','Use GET.');send(200,{status:'ok',storage:'mongodb',connected:mongoConnectionState()===1,authentication:false,frontendConnected:false});return}
      if(parts.length===1&&parts[0]==='schemas'){if(req.method!=='GET')throw new ApiError(405,'method_not_allowed','Use GET.');send(200,{models:Object.keys(entityContracts)});return}
      const [entity,id]=parts
      if(!isEntityType(entity)||parts.length>2)throw new ApiError(404,'route_not_found','Unknown collection or route.')
      if(entity==='activity'&&req.method!=='GET')throw new ApiError(405,'read_only','Activity records are read-only.')
      if(req.method==='GET'){if(id){const record=await controller.get(entity,id);res.setHeader('ETag',`"${record.revision}"`);send(200,{data:record})}else send(200,await controller.list(entity,Object.fromEntries(url.searchParams)));return}
      if(req.method==='POST'&&!id){const record=await controller.create(entity,await body(req));res.setHeader('Location',`${base}/${entity}/${record.id}`);res.setHeader('ETag',`"${record.revision}"`);send(201,{data:record});return}
      if(req.method==='PATCH'&&id){const expected=revision(req),record=await controller.update(entity,id,await body(req),expected);res.setHeader('ETag',`"${record.revision}"`);send(200,{data:record});return}
      if(req.method==='DELETE'&&id){await controller.delete(entity,id,revision(req));send(204);return}
      throw new ApiError(405,'method_not_allowed','Use GET, POST, PATCH or DELETE on the appropriate route.')
    }catch(error){
      if(error instanceof ApiError){send(error.status,{error:{code:error.code,message:error.message}});return}
      if(error instanceof z.ZodError){send(422,{error:{code:'validation_error',message:'Check the supplied fields.',issues:error.issues.map(issue=>({path:issue.path.join('.'),message:issue.message}))}});return}
      if(error&&typeof error==='object'&&'code'in error&&error.code===11000){send(409,{error:{code:'duplicate_record',message:'A record with these unique fields already exists.'}});return}
      send(500,{error:{code:'internal_error',message:'The operation could not complete.'}})
    }
  }
}
