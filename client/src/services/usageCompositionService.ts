import { usageComposeRequestSchema, validateUsageComposition, type UsageComposeRequest } from '../domain/usageComposition.ts'
import { createHttpClient } from './api/httpClient.ts'
import { ServiceError } from './serviceErrors.ts'
export function createUsageCompositionService(request?: typeof fetch) {
  const http = createHttpClient(request)
  return { async compose(input: UsageComposeRequest, options: { signal?: AbortSignal } = {}) {
    const parsed = usageComposeRequestSchema.safeParse(input)
    if (!parsed.success) throw new ServiceError('input', 'Invalid usage composition request.')
    const value = await http.requestJson('/api/workspace/compose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: options.signal })
    const result = validateUsageComposition(value, parsed.data)
    if (!result.success) throw new ServiceError('response', 'Invalid usage composition evidence or layout.')
    return result.data
  } }
}
