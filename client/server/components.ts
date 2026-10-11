import { safeIntentError } from './intentDiagnostics.ts'
import { componentModelInstructions, componentModelInput, normalizeModelIntent } from './componentModelIntent.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { componentRequestSchema, validateComponentResolution, fallbackComponentIntent } from '../src/domain/componentIntent.ts'
import { modelText } from './modelProvider.ts'
export async function componentIntentEndpoint(req: IncomingMessage,res: ServerResponse,env=process.env) {
  const send=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))}
  if(req.method!=='POST')return send(405,{error:{message:'Use POST to describe your workspace.'}})
  if(!req.headers['content-type']?.includes('application/json'))return send(415,{error:{message:'Expected application/json.'}})
  const controller=new AbortController();req.on('aborted',()=>controller.abort());res.on('close',()=>{if(!res.writableEnded)controller.abort()})
  try {
    let raw='';for await(const chunk of req){raw+=chunk.toString();if(Buffer.byteLength(raw)>200000)return send(413,{error:{message:'Request too large.'}})}
    let value:unknown;try{value=JSON.parse(raw)}catch{return send(400,{error:{message:'Invalid JSON.'}})}
    const parsed=componentRequestSchema.safeParse(value);if(!parsed.success)return send(400,{error:{message:'Provide a goal, valid reference date/timezone and catalog.'}})
    const input=parsed.data
    let result
    let fallbackReason:string|undefined
    let validationFields:string[]|undefined
    let providerStatus:number|undefined
    let providerCode:string|undefined
    let fallbackMessage:string|undefined
    let validationIssues:Array<{path:string;message:string}>|undefined
    try {
      const text=await modelText(env,componentModelInstructions,[{role:'user',content:JSON.stringify(componentModelInput(input))}],AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]),true)
      let candidate:unknown;try{candidate=JSON.parse(text)}catch{fallbackReason='invalid_json';fallbackMessage='The AI response was not valid JSON.';throw new Error('Invalid intent JSON')}
      const validated=validateComponentResolution(normalizeModelIntent(candidate,input),input)
      if(validated.success)result={...validated.data,source:'ai' as const}
      else {fallbackReason='invalid_intent';validationFields=validated.error.issues.map(issue=>issue.path.join('.'));validationIssues=validated.error.issues.slice(0,50).map(issue=>({path:issue.path.join('.')||'response',message:issue.message.slice(0,500)}));fallbackMessage='The AI response failed intent validation.';if(candidate&&typeof candidate==='object'&&'action' in candidate&&candidate.action==='view'){if('timezone' in candidate&&candidate.timezone!==input.timezone)fallbackReason='timezone_mismatch';else if('referenceDate' in candidate&&candidate.referenceDate!==input.referenceDate)fallbackReason='date_mismatch'}}
    }catch(failure){if(controller.signal.aborted)return;fallbackMessage??=safeIntentError(failure,env);if(failure&&typeof failure==='object'&&'status' in failure&&typeof failure.status==='number')providerStatus=failure.status;if(failure&&typeof failure==='object'&&'code' in failure&&typeof failure.code==='string')providerCode=failure.code;fallbackReason??=failure instanceof Error&&failure.name==='TimeoutError'?'timeout':failure&&typeof failure==='object'&&'status' in failure?'provider_error':'provider_unavailable'}
    result??=fallbackComponentIntent(input)
    if(result.source==='local')console.warn('[Orlo AI] Keyword fallback',{reason:fallbackReason,message:fallbackMessage,providerStatus,providerCode,validationIssues})
    send(200,{...result,...(result.source==='local'?{fallbackReason,fallbackMessage,validationFields,validationIssues,providerStatus,providerCode}:{})})
  }catch{if(!controller.signal.aborted)send(400,{error:{message:'Unable to resolve this request. Try describing the component and filters you need.'}})}
}
