import { ServiceError } from '../serviceErrors.ts'
let beforeRequest: ((url: string) => Promise<void>) | undefined
export function setApiBeforeRequest(hook?: (url: string) => Promise<void>) { beforeRequest = hook }
export function createHttpClient(request: typeof fetch = (...args) => fetch(...args)) {
  return {
    async requestJson(url: string, options: RequestInit = {}): Promise<unknown> {
      await beforeRequest?.(url)
      options = { ...options, credentials: 'same-origin' }
      let response: Response
      try { response = await request(url, options) }
      catch (error) {
        if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) throw error
        throw new ServiceError('network', 'Unable to reach the server. Check your connection and try again.')
      }
      let body: unknown
      try { body = await response.json() }
      catch (error) {
        if (options.signal?.aborted) throw error
        throw new ServiceError('response', 'The server returned an unreadable response. Try again.')
      }
      if (!response.ok) {
        const message = typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null && 'message' in body.error && typeof body.error.message === 'string' ? body.error.message : 'The request failed. Try again.'
        throw new ServiceError('http', message, response.status)
      }
      return body
    },
  }
}
