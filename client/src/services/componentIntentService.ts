import { recordMutationGoal } from '../domain/workspaceManagement'
import { componentRequestSchema, validateComponentResolution, fallbackComponentIntent, type ComponentRequest } from '../domain/componentIntent'
import { createHttpClient } from './api/httpClient'
export async function resolveComponentIntent(input: ComponentRequest, signal?: AbortSignal) {
  const parsed=componentRequestSchema.parse(input)
  if(recordMutationGoal(parsed.goal))return fallbackComponentIntent(parsed)
  try {
    const value=await createHttpClient().requestJson('/api/workspace/resolve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(parsed),signal})
    const result=validateComponentResolution(value,parsed)
    if(result.success)return result.data
  }catch(error){if(signal?.aborted)throw error}
  return fallbackComponentIntent(parsed)
}
