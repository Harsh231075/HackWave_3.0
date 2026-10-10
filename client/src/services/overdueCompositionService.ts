import { overdueComposeRequestSchema, validateOverdueComposition, type OverdueComposeRequest } from '../domain/overdueReview.ts'
import { createHttpClient } from './api/httpClient.ts'
import { ServiceError } from './serviceErrors.ts'
export function createOverdueCompositionService(request?: typeof fetch) {
  const http = createHttpClient(request)
  return { async compose(input: OverdueComposeRequest, options: { signal?: AbortSignal } = {}) {
    const parsed = overdueComposeRequestSchema.safeParse(input)
    if (!parsed.success) throw new ServiceError('input', 'Invalid overdue composition request.')
    const value = await http.requestJson('/api/workspace/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: options.signal })
    const result = validateOverdueComposition(value, parsed.data)
    if (!result.success) throw new ServiceError('response', 'Invalid overdue composition evidence or layout.')
    return result.data
  } }
}
