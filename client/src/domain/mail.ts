import { z } from 'zod'

export const mailWidgetIds = ['mail-inbox', 'mail-message', 'mail-compose'] as const
export const isMailWidget = (id: string) => (mailWidgetIds as readonly string[]).includes(id)
export const mailFolders = ['Inbox', 'All Mail', 'Sent', 'Drafts', 'Trash'] as const
export type MailFolder = typeof mailFolders[number]
export const MAIL_ATTACHMENT_LIMIT = 10 * 1024 * 1024
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'
export const gmailPartSchema: z.ZodType<GmailPart> = z.lazy(() => z.object({
  partId: z.string().optional(), mimeType: z.string().optional(), filename: z.string().optional(),
  headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  body: z.object({ data: z.string().optional(), attachmentId: z.string().optional(), size: z.number().optional() }).optional(),
  parts: z.array(gmailPartSchema).optional(),
}))
export interface GmailPart {
  partId?: string; mimeType?: string; filename?: string; headers?: { name: string; value: string }[]
  body?: { data?: string; attachmentId?: string; size?: number }; parts?: GmailPart[]
}
export const gmailMessageSchema = z.object({ id: z.string(), threadId: z.string(), labelIds: z.string().array().default([]), snippet: z.string().default(''), internalDate: z.string().optional(), payload: gmailPartSchema.optional() })
export type GmailMessage = z.infer<typeof gmailMessageSchema>
export const gmailDraftSchema = z.object({ id: z.string(), message: gmailMessageSchema })
export type GmailDraft = z.infer<typeof gmailDraftSchema>
export interface MailAttachment { name: string; mimeType: string; size: number; attachmentId?: string; data?: string }
export interface MailMessage {
  id: string; threadId: string; labels: string[]; subject: string; from: string; to: string; cc: string; bcc: string
  replyTo: string; messageId: string; references: string; snippet: string; date: string; text: string; html: string; attachments: MailAttachment[]
}
export interface ComposeDraft {
  to: string; cc: string; bcc: string; subject: string; body: string
  attachments: { name: string; mimeType: string; bytes: Uint8Array }[]
  threadId?: string; inReplyTo?: string; references?: string
}
export const emptyMailDraft = (): ComposeDraft => ({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] })
export function base64Bytes(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}
export function decodeBase64(data: string) {
  const binary = atob(data.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}
export const base64url = (bytes: Uint8Array) => base64Bytes(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export function decodeMailHeader(value: string) {
  const unfolded = value.replace(/\r?\n[ \t]+/g, ' ').replace(/(\?=)\s+(?==\?)/g, '$1')
  return unfolded.replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (word, charset: string, encoding: string, content: string) => {
    try {
      const bytes = encoding.toLowerCase() === 'b' ? decodeBase64(content) : Uint8Array.from(content.replace(/_/g, ' ').replace(/=([0-9a-f]{2})/gi, (_match, hex: string) => String.fromCharCode(parseInt(hex, 16))), c => c.charCodeAt(0))
      return new TextDecoder(charset).decode(bytes)
    } catch { return word }
  })
}
export const header = (message: GmailMessage, name: string) => decodeMailHeader(message.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '')
export function normalizeMail(message: GmailMessage): MailMessage {
  const text: string[] = [], html: string[] = [], attachments: MailAttachment[] = []
  function visit(part: GmailPart) {
    if (part.filename || part.body?.attachmentId && !['text/plain', 'text/html'].includes(part.mimeType ?? '')) {
      attachments.push({ name: part.filename || 'attachment', mimeType: part.mimeType ?? 'application/octet-stream', size: part.body?.size ?? 0, attachmentId: part.body?.attachmentId, data: part.body?.data })
    } else if (part.body?.data) {
      const charset = part.headers?.find(h => h.name.toLowerCase() === 'content-type')?.value.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] ?? 'utf-8'
      let decoder: TextDecoder
      try { decoder = new TextDecoder(charset) } catch { decoder = new TextDecoder() }
      const value = decoder.decode(decodeBase64(part.body.data))
      if (part.mimeType === 'text/plain') text.push(value)
      if (part.mimeType === 'text/html') html.push(value)
    }
    part.parts?.forEach(visit)
  }
  if (message.payload) visit(message.payload)
  return { id: message.id, threadId: message.threadId, labels: message.labelIds, snippet: message.snippet,
    subject: header(message, 'Subject') || '(No subject)', from: header(message, 'From'), to: header(message, 'To'), cc: header(message, 'Cc'), bcc: header(message, 'Bcc'),
    replyTo: header(message, 'Reply-To'), messageId: header(message, 'Message-ID'), references: header(message, 'References'), date: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : header(message, 'Date'),
    text: text.join('\n'), html: html.join('\n'), attachments }
}
// Keep the composer address grammar deliberately narrow; display names are accepted inside quotes.
export function addresses(value: string): string[] {
  if (/[\r\n\0]/.test(value)) throw new Error('Addresses cannot contain newlines.')
  if (!value.trim()) return []
  const items: string[] = []
  let current = '', quoted = false, angle = false
  for (const char of value) {
    if (char === '"') quoted = !quoted
    if (!quoted && char === '<') { if (angle) throw new Error('Choose a valid email address.'); angle = true }
    if (!quoted && char === '>') { if (!angle) throw new Error('Choose a valid email address.'); angle = false }
    if (char === ',' && !quoted && !angle) { items.push(current); current = '' } else current += char
  }
  if (quoted || angle) throw new Error('Complete the quoted name or email address.')
  items.push(current)
  const result = items.map(item => {
    const trimmed = item.trim(), email = trimmed.match(/<([^<>]+)>$/)?.[1] ?? trimmed
    if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(email)) throw new Error('Use comma-separated email addresses, for example name@example.com.')
    return email.toLowerCase()
  })
  if (value.trim() && !result.length) throw new Error('Choose a valid email address.')
  return [...new Set(result)]
}
function safeHeader(value: string) { if (/[\r\n\0]/.test(value)) throw new Error('Mail headers cannot contain newlines.'); return value }
function encodedHeader(value: string) {
  safeHeader(value)
  if (/^[\x20-\x7e]*$/.test(value) && value.length < 70) return value
  const chunks: string[] = []; let chunk = ''
  for (const char of value) { if (new TextEncoder().encode(chunk + char).length > 42) { chunks.push(chunk); chunk = '' }; chunk += char }
  if (chunk) chunks.push(chunk)
  return chunks.map(c => '=?UTF-8?B?' + base64Bytes(new TextEncoder().encode(c)) + '?=').join('\r\n ')
}
const wrappedBase64 = (bytes: Uint8Array) => base64Bytes(bytes).match(/.{1,76}/g)?.join('\r\n') ?? ''
export function buildMailMime(draft: ComposeDraft, from: string, requireRecipient = false) {
  const to = addresses(draft.to), cc = addresses(draft.cc), bcc = addresses(draft.bcc)
  if (requireRecipient && !to.length && !cc.length && !bcc.length) throw new Error('Add at least one recipient before sending.')
  if (draft.attachments.reduce((total, a) => total + a.bytes.length, 0) > MAIL_ATTACHMENT_LIMIT) throw new Error('Attachments must total 10 MiB or less.')
  const sender = addresses(from)
  if (sender.length !== 1) throw new Error('Connect a valid Gmail address before saving or sending.')
  const lines = ['From: ' + sender[0], ...(to.length ? ['To: ' + to.join(',\r\n ')] : []), ...(cc.length ? ['Cc: ' + cc.join(',\r\n ')] : []), ...(bcc.length ? ['Bcc: ' + bcc.join(',\r\n ')] : []), 'Subject: ' + encodedHeader(draft.subject), 'MIME-Version: 1.0']
  if (draft.inReplyTo) lines.push('In-Reply-To: ' + safeHeader(draft.inReplyTo))
  if (draft.references) lines.push('References: ' + safeHeader(draft.references))
  const text = ['Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrappedBase64(new TextEncoder().encode(draft.body.replace(/\r?\n/g, '\r\n')))].join('\r\n')
  if (!draft.attachments.length) return lines.join('\r\n') + '\r\n' + text
  const boundary = 'orlo-' + crypto.randomUUID()
  lines.push('Content-Type: multipart/mixed; boundary="' + boundary + '"', '', '--' + boundary, text)
  for (const attachment of draft.attachments) {
    safeHeader(attachment.name)
    const mime = /^[\w.+-]+\/[\w.+-]+$/.test(attachment.mimeType) ? attachment.mimeType : 'application/octet-stream'
    const filename = encodeURIComponent(attachment.name).replace(/'/g, '%27')
    lines.push('--' + boundary, 'Content-Type: ' + mime, 'Content-Disposition: attachment; filename="attachment"; filename*=UTF-8\'\'' + filename, 'Content-Transfer-Encoding: base64', '', wrappedBase64(attachment.bytes))
  }
  lines.push('--' + boundary + '--', '')
  return lines.join('\r\n')
}
export function replyDraft(message: MailMessage, account: string, mode: 'reply' | 'reply-all' | 'forward', fallbackText = ''): ComposeDraft {
  const forward = mode === 'forward', own = account.toLowerCase()
  const sender = addresses(message.replyTo || message.from)
  const to = forward ? [] : sender.filter(a => a !== own)
  const cc = mode === 'reply-all' ? [...new Set([...addresses(message.to), ...addresses(message.cc)].filter(a => a !== own && !to.includes(a)))] : []
  return { ...emptyMailDraft(), to: to.join(', '), cc: cc.join(', '), subject: forward ? 'Fwd: ' + message.subject : /^re:/i.test(message.subject) ? message.subject : 'Re: ' + message.subject,
    body: '\n\n' + (forward ? '---------- Forwarded message ----------' : `On ${message.date}, ${message.from} wrote:`) + '\n' + (message.text || fallbackText || message.snippet).split('\n').map(line => '> ' + line).join('\n'),
    ...(!forward && message.messageId ? { threadId: message.threadId, inReplyTo: message.messageId, references: (message.references + ' ' + message.messageId).trim() } : {}) }
}
