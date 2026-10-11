import type { ExtensionId } from '../extensions/contracts.ts'
import type { GenerationService } from './contracts.ts'
import { ServiceError } from './serviceErrors.ts'
import { createHttpClient } from './api/httpClient.ts'
export function createGenerationService(request?: typeof fetch, enabled?:()=>ExtensionId[], plugins?:()=>Array<{id:string;name:string;description:string}>): GenerationService {
  const http = createHttpClient(request)
  return {
    async generate(input, { signal } = {}) {
      const body = await http.requestJson('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: JSON.stringify({...input,...(enabled?{enabledExtensions:enabled(),...(plugins?{externalPlugins:plugins()}: {})}: {})}) })
      if (typeof body !== 'object' || body === null || !('response' in body) || typeof body.response !== 'string' || !body.response.trim()) throw new ServiceError('response', 'The model returned an empty workspace. Try again.')
      return { response: body.response }
    },
  }
}
