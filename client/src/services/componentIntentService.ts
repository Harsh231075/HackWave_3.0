import { logKeywordFallback } from './intentDiagnostics.ts'
import { isServiceError } from './serviceErrors.ts'
import { componentRequestSchema, validateComponentResolution, fallbackComponentIntent, type ComponentRequest } from '../domain/componentIntent.ts'
import { createHttpClient } from './api/httpClient.ts'
export async function resolveComponentIntent(input: ComponentRequest, signal?: AbortSignal) {
  const parsed=componentRequestSchema.parse(input)
  try {
    const value=await createHttpClient().requestJson('/api/workspace/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed),signal})
    const result=validateComponentResolution(value,parsed)
    if(result.success){
      if(result.data.source==='local')logKeywordFallback(value,{reason:'server_fallback',message:'The server used keyword matching because AI did not return a valid decision.'})
      return result.data
    }
    logKeywordFallback({validationIssues:result.error.issues.slice(0,50).map(issue=>({path:issue.path.join('.')||'response',message:issue.message.slice(0,500)}))},{reason:'client_validation',message:'The server response failed client intent validation.'})
  }catch(error){
    if(signal?.aborted)throw error
    const reason=isServiceError(error)?error.code: error instanceof Error&&error.name==='TimeoutError'?'timeout':'network'
    logKeywordFallback({httpStatus:isServiceError(error)?error.status:undefined},{reason,message:reason==='http'?'The intent endpoint returned an HTTP error.':reason==='response'?'The intent endpoint returned unreadable JSON.':reason==='timeout'?'The intent request timed out.':'The intent endpoint could not be reached.'})
  }
  return fallbackComponentIntent(parsed)
}
