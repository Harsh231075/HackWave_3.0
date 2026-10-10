import { composeRequestSchema, validateMeetingComposition, type ComposeRequest } from '../domain/adaptiveData.ts'
import { createHttpClient } from './api/httpClient.ts'
import { ServiceError } from './serviceErrors.ts'
export function createMeetingCompositionService(request?: typeof fetch) {
  const http = createHttpClient(request)
  return { async compose(input: ComposeRequest, options: { signal?: AbortSignal } = {}) {
    const parsed = composeRequestSchema.safeParse(input)
    if (!parsed.success) throw new ServiceError('input', `Invalid meeting composition request: ${parsed.error.issues[0]?.message}`)
    const value = await http.requestJson('/api/workspace/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: options.signal })
    const result = validateMeetingComposition(value, parsed.data)
    if (!result.success) throw new ServiceError('response', `Invalid meeting composition: ${result.error.issues[0]?.message}`)
    return result.data
  } }
}
