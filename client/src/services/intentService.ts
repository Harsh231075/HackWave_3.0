import { applyIntentContinuity } from '../domain/intentContinuity.ts'
import { intentRequestSchema, validateIntentResolution, type IntentRequest, type IntentResolution } from '../domain/intent.ts'
import { ServiceError } from './serviceErrors.ts'

export type IntentResolver = (request: IntentRequest, options?: { signal?: AbortSignal }) => Promise<unknown>
export interface IntentService {
  resolve(request: IntentRequest, options?: { signal?: AbortSignal }): Promise<IntentResolution>
}

export function createIntentService(resolver: IntentResolver): IntentService {
  return {
    async resolve(request, options = {}) {
      const input = intentRequestSchema.safeParse(request)
      if (!input.success) throw new ServiceError('input', `Invalid intent request: ${input.error.issues[0]?.message}`)
      options.signal?.throwIfAborted()
      const response = await resolver(input.data, options)
      options.signal?.throwIfAborted()
      const result = validateIntentResolution(applyIntentContinuity(response, input.data), input.data)
      if (!result.success) throw new ServiceError('response', `Invalid intent response: ${result.error.issues[0]?.message}`)
      return result.data
    },
  }
}
