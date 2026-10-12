import { mailPlainText } from './safeMail.ts'
import { createMailService } from './mailService.ts'
import { createMailCache } from './mailCache.ts'
import { loadMailIdentity, requestMailToken } from './googleIdentity.ts'
import { createHttpClient } from '../../services/api/httpClient.ts'
const http = createHttpClient()
const runtime = createMailService({
  prepare: async () => {
    const state = await http.requestJson('/api/mail/connection') as { connected: boolean; email?: string; expires_in?: number }
    if (state.connected && state.email && state.expires_in) runtime.restoreConnection(state.email, state.expires_in)
    await loadMailIdentity()
  },
  htmlToText: mailPlainText,
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  authorize: async (clientId, hint) => {
    const token = await requestMailToken(await loadMailIdentity(), clientId, hint)
    await http.requestJson('/api/mail/connection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token.access_token, expires_in: token.expires_in ?? 3600, scope: token.scope ?? '' }) })
    return { ...token, access_token: 'backend-session' }
  },
  revoke: async () => { await http.requestJson('/api/mail/revoke', { method: 'POST' }) },
  transport: async (input, init) => {
    const path = String(input).replace('https://gmail.googleapis.com/gmail/v1/users/me/', '')
    const headers = new Headers(init?.headers); headers.delete('Authorization')
    return fetch('/api/mail/gmail/' + path, { ...init, headers, credentials: 'same-origin' })
  },
  cacheMessages: false,
  cache: createMailCache(() => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} })),
})
export const mailService = {
  ...runtime,
  async disconnect(force = false) {
    // Forced cleanup clears UI state when an account changes without touching another session's connection.
    if (force) { runtime.disconnect(true); return }
    if (runtime.hasUnsaved()) throw new Error('Save or discard your draft before disconnecting.')
    await http.requestJson('/api/mail/connection', { method: 'DELETE' })
    runtime.disconnect()
  },
}
