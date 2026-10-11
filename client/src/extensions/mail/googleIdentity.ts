import { GMAIL_SCOPE } from '../../domain/mail.ts'
export interface TokenResponse { access_token?: string; expires_in?: number; scope?: string; error?: string }
export interface MailIdentity {
  initTokenClient(options: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void }): { requestAccessToken(options?: { prompt?: string; hint?: string }): void }
  revoke(token: string, callback: (result: { successful: boolean }) => void): void
}
let loading: Promise<MailIdentity> | undefined
export function loadMailIdentity(): Promise<MailIdentity> {
  const get = () => (globalThis as typeof globalThis & { google?: { accounts?: { oauth2?: MailIdentity } } }).google?.accounts?.oauth2
  const existing = get()
  if (existing) return Promise.resolve(existing)
  if (!loading) loading = new Promise<MailIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'; script.async = true
    const timer = setTimeout(() => { script.remove(); reject(new Error('Google sign-in did not load. Check your connection and try again.')) }, 15000)
    script.onload = () => { clearTimeout(timer); const api = get(); if (api) resolve(api); else reject(new Error('Google sign-in is unavailable.')) }
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Google sign-in could not load. Check content blockers and try again.')) }
    document.head.append(script)
  }).catch(error => { loading = undefined; throw error })
  return loading
}
export function requestMailToken(identity: MailIdentity, clientId: string, hint?: string): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    const client = identity.initTokenClient({ client_id: clientId, scope: GMAIL_SCOPE,
      callback: response => response.error ? reject(new Error('Google permission was not granted. Try connecting again.')) : resolve(response),
      error_callback: error => reject(new Error(error.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Allow the Google sign-in popup, then try again.')) })
    client.requestAccessToken({ prompt: hint ? '' : 'select_account', ...(hint ? { hint } : {}) })
  })
}
