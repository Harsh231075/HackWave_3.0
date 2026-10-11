import { z } from 'zod'
import { base64url, buildMailMime, decodeBase64, emptyMailDraft, gmailDraftSchema, gmailMessageSchema, GMAIL_SCOPE, normalizeMail, type ComposeDraft, type MailAttachment, type MailFolder, type MailMessage } from '../../domain/mail.ts'
import type { TokenResponse } from './googleIdentity.ts'

export class MailError extends Error {
  status: number
  uncertain: boolean
  constructor(status: number, message: string, uncertain = false) { super(message); this.status = status; this.uncertain = uncertain }
}
export interface MailEditor { draft: ComposeDraft; id?: string; revision?: string; version: number; savedVersion: number; status: 'unsaved' | 'saving' | 'saved' | 'sending' | 'uncertain'; error: string }
export interface MailSnapshot { configured: boolean; status: 'disconnected' | 'connecting' | 'connected' | 'expired'; accountId?: string; email?: string; error: string; selectedId?: string; sentDraftId?: string; editor: MailEditor | null; revision: number }
interface MailOptions {
  clientId: string; transport?: typeof fetch; now?: () => number
  authorize: (clientId: string, hint?: string) => Promise<TokenResponse>
  revoke: (token: string) => Promise<void>
  htmlToText?: (html: string) => string
}
const listSchema = z.object({ messages: z.array(z.object({ id: z.string() })).default([]), nextPageToken: z.string().optional() })
const draftListSchema = z.object({ drafts: z.array(z.object({ id: z.string() })).default([]), nextPageToken: z.string().optional() })
const encoded = encodeURIComponent
const folderQuery: Record<MailFolder, string> = { Inbox: 'in:inbox', 'All Mail': '-in:spam -in:trash', Sent: 'in:sent', Drafts: 'in:drafts', Trash: 'in:trash' }
export function createMailService(options: MailOptions) {
  const transport = options.transport ?? fetch, now = options.now ?? Date.now
  let token = '', expires = 0, epoch = 0, timer: ReturnType<typeof setTimeout> | undefined, autosave: ReturnType<typeof setTimeout> | undefined
  let snapshot: MailSnapshot = { configured: !!options.clientId, status: 'disconnected', error: '', editor: null, revision: 0 }
  const listeners = new Set<() => void>(), requests = new Set<AbortController>()
  const messages = new Map<string, MailMessage>()
  let saving: Promise<void> | undefined, sending: Promise<void> | undefined, connecting: Promise<void> | undefined
  function publish(patch: Partial<MailSnapshot>) { snapshot = { ...snapshot, ...patch }; listeners.forEach(fn => fn()) }
  function editorPatch(patch: Partial<MailEditor>) { if (snapshot.editor) publish({ editor: { ...snapshot.editor, ...patch } }) }
  function cancelRequests() { epoch++; for (const controller of requests) controller.abort(); requests.clear(); messages.clear() }
  function expire() { token = ''; expires = 0; clearTimeout(timer); cancelRequests(); publish({ status: 'expired', error: 'Mail access expired. Reconnect to continue.' }) }
  function authorized() { if (!token || expires <= now() + 5000) { expire(); throw new MailError(401, 'Reconnect Gmail to continue.') } }
  async function api(path: string, init: RequestInit = {}, retries = 0): Promise<unknown> {
    authorized()
    const requestEpoch = epoch, controller = new AbortController()
    requests.add(controller)
    const timeout = setTimeout(() => controller.abort(), 20000)
    const read = !init.method || init.method === 'GET'
    try {
      const response = await transport('https://gmail.googleapis.com/gmail/v1/users/me/' + path, { ...init, signal: init.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal, headers: { Authorization: 'Bearer ' + token, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } })
      if (requestEpoch !== epoch) throw new MailError(409, 'Mail connection changed. Reload this view.')
      if (response.status === 401) { expire(); throw new MailError(401, 'Reconnect Gmail to continue.') }
      if (read && (response.status === 429 || response.status >= 500) && retries < 2) {
        await new Promise(resolve => setTimeout(resolve, 300 * 2 ** retries))
        if (requestEpoch !== epoch || init.signal?.aborted) throw new MailError(409, 'Mail connection changed or request was cancelled.')
        return api(path, init, retries + 1)
      }
      if (!response.ok) throw new MailError(response.status, response.status === 403 ? 'Google did not allow this operation. Check Gmail permissions and quota.' : response.status === 404 ? 'This message or draft is no longer available. Refresh Mail.' : response.status === 429 ? 'Gmail is busy. Try again shortly.' : 'Gmail could not complete this operation.', !read && response.status >= 500)
      if (response.status === 204) return null
      return await response.json()
    } catch (error) {
      if (error instanceof MailError) throw error
      throw new MailError(502, 'Gmail request failed. Check your connection.', !read)
    } finally { clearTimeout(timeout); requests.delete(controller) }
  }
  const changed = () => { messages.clear(); publish({ revision: snapshot.revision + 1 }) }
  function scheduleSave() {
    clearTimeout(autosave)
    if (snapshot.editor && snapshot.status === 'connected' && snapshot.editor.status === 'unsaved') autosave = setTimeout(() => { void saveDraft().catch(() => { /* saveDraft preserves the editor and records its own error. */ }) }, 1000)
  }
  function ensureSafeClose() {
    if (saving || sending || snapshot.editor?.status === 'uncertain') throw new MailError(409, 'Wait for the operation or check Sent before closing this draft.')
    if (snapshot.editor && snapshot.editor.version !== snapshot.editor.savedVersion) throw new MailError(409, 'Save or discard unsaved edits first.')
  }
  async function saveDraft(forSend = false) {
    if (sending && !forSend) throw new MailError(409, 'Sending is already in progress.')
    if (saving) { await saving; if (snapshot.editor && snapshot.editor.version !== snapshot.editor.savedVersion) return saveDraft(forSend); return }
    const editor = snapshot.editor
    if (!editor || editor.status === 'uncertain') return
    if (editor.id && editor.version === editor.savedVersion) return
    authorized()
    const account = snapshot.accountId, requestEpoch = epoch
    let raw: string
    try { raw = base64url(new TextEncoder().encode(buildMailMime(editor.draft, snapshot.email!))) }
    catch (error) { editorPatch({ status: 'unsaved', error: (error as Error).message }); throw error }
    editorPatch({ status: 'saving', error: '' })
    saving = (async () => {
      if (editor.id) {
        const current = gmailDraftSchema.parse(await api('drafts/' + encoded(editor.id) + '?format=minimal'))
        if (current.message.id !== editor.revision) throw new MailError(409, 'This draft changed in Gmail. Reopen it or save your edits as a new draft.')
      }
      const result = gmailDraftSchema.parse(await api(editor.id ? 'drafts/' + encoded(editor.id) : 'drafts', { method: editor.id ? 'PUT' : 'POST', body: JSON.stringify({ message: { raw, ...(editor.draft.threadId ? { threadId: editor.draft.threadId } : {}) } }) }))
      if (requestEpoch !== epoch || account !== snapshot.accountId || !snapshot.editor) throw new MailError(409, 'Mail connection changed while saving.')
      editorPatch({ id: result.id, revision: result.message.id, savedVersion: editor.version, status: snapshot.editor.version === editor.version ? 'saved' : 'unsaved' })
      changed()
    })().catch(error => { if (requestEpoch === epoch) editorPatch({ status: 'unsaved', error: error.message }); throw error }).finally(() => { saving = undefined; if (!snapshot.editor?.error && !sending) scheduleSave() })
    return saving
  }
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    getSnapshot: () => snapshot,
    hasUnsaved: () => !!snapshot.editor && (snapshot.editor.version !== snapshot.editor.savedVersion || ['saving', 'sending', 'uncertain'].includes(snapshot.editor.status)),
    async connect() {
      if (connecting) return connecting
      if (!options.clientId) throw new MailError(503, 'Configure VITE_GOOGLE_CLIENT_ID and restart the frontend.')
      if (saving || sending) throw new MailError(409, 'Wait for the current Mail operation.')
      const previous = snapshot, previousToken = token, previousExpires = expires
      publish({ status: 'connecting', error: '' })
      const requestEpoch = epoch
      connecting = (async () => {
        const response = await options.authorize(options.clientId, previous.email)
        if (requestEpoch !== epoch) throw new MailError(409, 'Mail connection changed.')
        if (!response.access_token || !response.scope?.split(/\s+/).includes(GMAIL_SCOPE)) throw new MailError(403, 'Allow Gmail read and modify access to connect Mail.')
        token = response.access_token; expires = now() + (response.expires_in ?? 3600) * 1000
        const profile = z.object({ emailAddress: z.email() }).parse(await api('profile'))
        if (previous.accountId && previous.accountId !== profile.emailAddress.toLowerCase() && previous.editor) throw new MailError(409, 'Save or discard the original account’s draft before switching accounts.')
        clearTimeout(timer); cancelRequests()
        const accountId = profile.emailAddress.toLowerCase()
        publish({ status: 'connected', accountId, email: profile.emailAddress, error: '', selectedId: previous.accountId === accountId ? previous.selectedId : undefined, editor: previous.accountId && previous.accountId !== accountId ? null : previous.editor, revision: snapshot.revision + 1 })
        timer = setTimeout(expire, Math.max(0, expires - now() - 5000)); scheduleSave()
      })().catch(error => {
        if (requestEpoch === epoch) { token = previousToken; expires = previousExpires; publish({ ...previous, status: previousToken && previousExpires > now() + 5000 ? 'connected' : previous.accountId ? 'expired' : 'disconnected', error: error.message }) }
        throw error
      }).finally(() => { connecting = undefined })
      return connecting
    },
    disconnect(force = false) {
      if (!force) ensureSafeClose()
      clearTimeout(timer); clearTimeout(autosave); cancelRequests(); token = ''; expires = 0
      publish({ status: 'disconnected', accountId: undefined, email: undefined, selectedId: undefined, error: '', editor: null, revision: snapshot.revision + 1 })
    },
    async revoke() { ensureSafeClose(); authorized(); await options.revoke(token); this.disconnect() },
    refresh: changed,
    selectMessage: (selectedId: string) => publish({ selectedId }),
    async listMessages(folder: MailFolder, query = '', pageToken = '', signal?: AbortSignal) {
      if (folder === 'Drafts') return this.listDrafts(query, pageToken, signal)
      const data = listSchema.parse(await api('messages?' + new URLSearchParams({ maxResults: '25', q: folderQuery[folder] + (query ? ' (' + query + ')' : ''), ...(pageToken ? { pageToken } : {}), ...(folder === 'Trash' ? { includeSpamTrash: 'true' } : {}) }), { signal }))
      const result: MailMessage[] = []
      for (let index = 0; index < data.messages.length; index += 5) {
        const batch = await Promise.all(data.messages.slice(index, index + 5).map(async item => normalizeMail(gmailMessageSchema.parse(await api('messages/' + encoded(item.id) + '?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date', { signal })))))
        result.push(...batch)
      }
      return { messages: result.map(message => ({ message, draftId: undefined as string | undefined })), nextPageToken: data.nextPageToken }
    },
    async listDrafts(query = '', pageToken = '', signal?: AbortSignal) {
      const data = draftListSchema.parse(await api('drafts?' + new URLSearchParams({ maxResults: '25', ...(query ? { q: query } : {}), ...(pageToken ? { pageToken } : {}) }), { signal }))
      const result: { message: MailMessage; draftId: string | undefined }[] = []
      for (let index = 0; index < data.drafts.length; index += 5) result.push(...await Promise.all(data.drafts.slice(index, index + 5).map(async item => { const draft = gmailDraftSchema.parse(await api('drafts/' + encoded(item.id) + '?format=metadata', { signal })); return { message: normalizeMail(draft.message), draftId: draft.id } })))
      return { messages: result, nextPageToken: data.nextPageToken }
    },
    async getMessage(id: string, signal?: AbortSignal) {
      if (messages.has(id)) { authorized(); return messages.get(id)! }
      const requestEpoch = epoch
      const raw = gmailMessageSchema.parse(await api('messages/' + encoded(id) + '?format=full', { signal }))
      // Gmail may externalize large text bodies as attachments, too.
      async function hydrate(part: NonNullable<typeof raw.payload>) {
        if (!part.filename && part.body?.attachmentId && ['text/plain', 'text/html'].includes(part.mimeType ?? '')) {
          const body = z.object({ data: z.string() }).parse(await api('messages/' + encoded(id) + '/attachments/' + encoded(part.body.attachmentId), { signal }))
          part.body.data = body.data
        }
        for (const child of part.parts ?? []) await hydrate(child)
      }
      if (raw.payload) await hydrate(raw.payload)
      const message = normalizeMail(raw)
      if (requestEpoch !== epoch) throw new MailError(409, 'Mail connection changed.')
      messages.set(id, message); if (messages.size > 50) messages.delete(messages.keys().next().value!); return message
    },
    async attachmentBytes(messageId: string, attachment: MailAttachment) {
      authorized()
      if (attachment.data) return decodeBase64(attachment.data)
      if (!attachment.attachmentId) throw new MailError(404, 'Attachment data is unavailable.')
      const response = z.object({ data: z.string() }).parse(await api('messages/' + encoded(messageId) + '/attachments/' + encoded(attachment.attachmentId)))
      return decodeBase64(response.data)
    },
    async action(id: string, action: 'read' | 'unread' | 'archive' | 'trash' | 'restore') {
      const changes = action === 'read' ? { removeLabelIds: ['UNREAD'] } : action === 'unread' ? { addLabelIds: ['UNREAD'] } : { removeLabelIds: ['INBOX'] }
      await api('messages/' + encoded(id) + '/' + (action === 'trash' ? 'trash' : action === 'restore' ? 'untrash' : 'modify'), { method: 'POST', body: JSON.stringify(action === 'trash' || action === 'restore' ? {} : changes) }); changed()
    },
    startDraft(draft: ComposeDraft = emptyMailDraft()) { ensureSafeClose(); clearTimeout(autosave); publish({ editor: { draft, version: 1, savedVersion: 0, status: 'unsaved', error: '' } }); scheduleSave() },
    async openDraft(id: string) {
      ensureSafeClose(); const requestEpoch = epoch, previousEditor = snapshot.editor
      messages.clear()
      const raw = gmailDraftSchema.parse(await api('drafts/' + encoded(id) + '?format=full'))
      const message = await this.getMessage(raw.message.id)
      const attachments = [] as ComposeDraft['attachments']
      for (const attachment of message.attachments) attachments.push({ name: attachment.name, mimeType: attachment.mimeType, bytes: await this.attachmentBytes(message.id, attachment) })
      if (requestEpoch !== epoch || snapshot.editor !== previousEditor) throw new MailError(409, 'The editor changed while loading. Try again.')
      publish({ editor: { id: raw.id, revision: raw.message.id, draft: { to: message.to, cc: message.cc, bcc: message.bcc, subject: message.subject === '(No subject)' ? '' : message.subject, body: message.text || options.htmlToText?.(message.html) || '', attachments, threadId: message.threadId, inReplyTo: raw.message.payload?.headers?.find(h => h.name.toLowerCase() === 'in-reply-to')?.value, references: message.references }, version: 0, savedVersion: 0, status: 'saved', error: message.html && !message.text ? 'This is an HTML draft. Editing will replace its formatting with plain text.' : '' } })
    },
    editDraft(patch: Partial<ComposeDraft>) {
      if (!snapshot.editor || sending || ['sending', 'uncertain'].includes(snapshot.editor.status)) return
      editorPatch({ draft: { ...snapshot.editor.draft, ...patch }, version: snapshot.editor.version + 1, status: 'unsaved', error: '' }); scheduleSave()
    },
    closeDraft(discard = false) { if (!discard) ensureSafeClose(); else if (saving || sending) throw new MailError(409, 'Wait for the Mail operation to finish.'); clearTimeout(autosave); publish({ editor: null }) },
    saveDraft,
    async saveAsNew() { if (snapshot.editor?.status === 'uncertain') throw new MailError(409, 'Check Sent before retrying an uncertain send.'); if (saving || sending) throw new MailError(409, 'Wait for the current operation.'); editorPatch({ id: undefined, revision: undefined, savedVersion: -1, status: 'unsaved', error: '' }); return saveDraft() },
    async deleteDraft() {
      if (saving || sending) throw new MailError(409, 'Wait for the current operation.')
      const id = snapshot.editor?.id
      if (id) await api('drafts/' + encoded(id), { method: 'DELETE' })
      this.closeDraft(true); changed()
    },
    async sendDraft() {
      if (sending) return sending
      if (!snapshot.editor || snapshot.editor.status === 'uncertain') throw new MailError(409, 'Check Sent before retrying an uncertain send.')
      buildMailMime(snapshot.editor.draft, snapshot.email ?? '', true)
      clearTimeout(autosave)
      // Reserve the send before awaiting saves so a second click cannot race the first.
      const operation = (async () => {
        await saveDraft(true)
        if (snapshot.editor && snapshot.editor.version !== snapshot.editor.savedVersion) await saveDraft(true)
        const editor = snapshot.editor!
        const requestEpoch = epoch
        clearTimeout(autosave); editorPatch({ status: 'sending', error: '' })
        try {
          await api('drafts/send', { method: 'POST', body: JSON.stringify({ id: editor.id }) })
          if (requestEpoch !== epoch) throw new MailError(409, 'Connection changed while sending.', true)
          publish({ editor: null, sentDraftId: editor.id }); changed()
        } catch (error) {
          const uncertain = error instanceof MailError && error.uncertain
          editorPatch({ status: uncertain ? 'uncertain' : 'saved', error: uncertain ? 'Send outcome is uncertain. Check Sent before retrying; do not send a duplicate.' : (error as Error).message }); throw error
        }
      })()
      sending = operation.finally(() => { sending = undefined })
      return sending
    },
  }
}
export type MailService = ReturnType<typeof createMailService>
