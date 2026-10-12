import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addresses, base64url, buildMailMime, decodeBase64, decodeMailHeader, emptyMailDraft, GMAIL_SCOPE, normalizeMail, replyDraft, type GmailMessage } from '../client/src/domain/mail.ts'
import { createMailService, MailError } from '../client/src/extensions/mail/mailService.ts'
import { fallbackComponentIntent, validateComponentResolution } from '../client/src/domain/componentIntent.ts'
import { capabilityAllowed, extensionForWidget } from '../client/src/extensions/catalog.ts'
import { applyComponentView } from '../client/src/domain/instanceViews.ts'
import { emptyWorkspace } from '../client/src/domain/workspaceDocument.ts'
import { makeInstance, widgetInstanceSchema } from '../client/src/domain/widgetInstances.ts'
import { requestMailToken, type MailIdentity } from '../client/src/extensions/mail/googleIdentity.ts'

const response = (value: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), { status })
const message = (id = 'message-1', payload: GmailMessage['payload'] = {}): GmailMessage => ({ id, threadId: 'thread-1', labelIds: ['INBOX', 'UNREAD'], snippet: 'Preview', payload })
function setup(override?: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const requests: { url: string; init?: RequestInit }[] = []
  let clock = 100, identity = 'me@example.com', nextRevision = 0
  const service = createMailService({ clientId: 'demo-client', now: () => clock,
    authorize: async () => ({ access_token: 'private-token', expires_in: 3600, scope: GMAIL_SCOPE }), revoke: async () => {},
    transport: (async (url: string | URL | Request, init?: RequestInit) => {
      const value = String(url); requests.push({ url: value, init })
      if (value.endsWith('/profile')) return response({ emailAddress: identity })
      if (override) return override(value, init)
      if (value.endsWith('/drafts/send')) return response(message('sent-1'))
      if (value.endsWith('/drafts') && init?.method === 'POST' || /\/drafts\/draft-1$/.test(value) && init?.method === 'PUT') return response({ id: 'draft-1', message: message('revision-' + ++nextRevision) })
      if (value.includes('/drafts/draft-1?')) return response({ id: 'draft-1', message: message('revision-' + nextRevision) })
      return response({ messages: [] })
    }) as typeof fetch })
  return { service, requests, advance: () => { clock += 3600000 }, setIdentity: (email: string) => { identity = email } }
}
test('MIME preserves Unicode, text and binary attachments, with safe folded headers', () => {
  const draft = { ...emptyMailDraft(), to: 'Person <person@example.com>', subject: 'नमस्ते '.repeat(15), body: 'Hello 🌊\nNext line', attachments: [{ name: 'résumé.pdf', mimeType: 'application/pdf', bytes: Uint8Array.from([0, 255, 80]) }] }
  const mime = buildMailMime(draft, 'me@example.com', true)
  assert.match(mime, /multipart\/mixed/); assert.match(mime, /filename\*=UTF-8''r%C3%A9sum%C3%A9.pdf/); assert.match(mime, /AP9Q/)
  const encoded = [...mime.matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g)].map(match => new TextDecoder().decode(decodeBase64(match[1]))).join('')
  assert.equal(encoded, draft.subject)
  assert.ok(mime.includes(btoa(unescape(encodeURIComponent('Hello 🌊\r\nNext line')))))
})
test('MIME rejects injected headers, invalid recipients and oversized attachments', () => {
  assert.throws(() => addresses('a@example.com\r\nBcc: victim@example.com'))
  assert.throws(() => addresses('invalid'))
  assert.throws(() => buildMailMime({ ...emptyMailDraft(), to: 'a@example.com', subject: 'Hello\r\nBcc: a@example.com' }, 'me@example.com', true))
  assert.throws(() => buildMailMime(emptyMailDraft(), 'me@example.com', true), /recipient/)
  assert.throws(() => buildMailMime({ ...emptyMailDraft(), attachments: [{ name: 'large', mimeType: '', bytes: new Uint8Array(10 * 1024 * 1024 + 1) }] }, 'me@example.com'), /10 MiB/)
})
test('nested Gmail MIME is decoded and attachment metadata retained', () => {
  const raw = message('m', { mimeType: 'multipart/mixed', headers: [{ name: 'Subject', value: 'Unicode 🌊' }], parts: [{ mimeType: 'multipart/alternative', parts: [{ mimeType: 'text/plain', body: { data: base64url(new TextEncoder().encode('नमस्ते')) } }, { mimeType: 'text/html', body: { data: base64url(new TextEncoder().encode('<b>Hello</b>')) } }] }, { filename: 'file.pdf', mimeType: 'application/pdf', body: { attachmentId: 'a', size: 120 } }] })
  const result = normalizeMail(raw)
  assert.equal(result.text, 'नमस्ते'); assert.equal(result.html, '<b>Hello</b>'); assert.equal(result.attachments[0].attachmentId, 'a')
})
test('reply all omits own address and forward does not retain threading or attachments', () => {
  const original = normalizeMail(message('m', { headers: [{ name: 'From', value: 'Sender <sender@example.com>' }, { name: 'To', value: 'me@example.com, friend@example.com' }, { name: 'Cc', value: 'friend@example.com' }, { name: 'Message-ID', value: '<message@example.com>' }, { name: 'Subject', value: 'Subject' }] }))
  const reply = replyDraft(original, 'me@example.com', 'reply-all')
  assert.equal(reply.to, 'sender@example.com'); assert.equal(reply.cc, 'friend@example.com'); assert.equal(reply.threadId, 'thread-1'); assert.equal(reply.inReplyTo, '<message@example.com>')
  const forward = replyDraft(original, 'me@example.com', 'forward'); assert.equal(forward.to, ''); assert.equal(forward.threadId, undefined); assert.deepEqual(forward.attachments, [])
})
test('token expiry retains unsaved editor; reconnect does not send', async () => {
  const { service, requests, advance } = setup()
  try {
    await service.connect(); service.startDraft(); service.editDraft({ body: 'Unsaved private body' }); advance()
    await assert.rejects(service.listMessages('Inbox'), /Reconnect/)
    assert.equal(service.getSnapshot().editor?.draft.body, 'Unsaved private body')
    await service.connect(); assert.equal(requests.some(r => r.url.endsWith('/drafts/send')), false)
    assert.throws(() => service.disconnect(), /Save or discard/)
  } finally { service.disconnect(true) }
})
test('saved Gmail drafts survive connection clearing, and credentials never enter snapshots', async () => {
  const { service, requests } = setup()
  await service.connect(); service.startDraft(); service.editDraft({ to: 'person@example.com', body: 'A draft' }); await service.saveDraft()
  assert.equal(service.getSnapshot().editor?.id, 'draft-1')
  assert.equal(JSON.stringify(service.getSnapshot()).includes('private-token'), false)
  service.disconnect(); assert.equal(service.getSnapshot().editor, null)
  assert.equal(requests.some(r => r.init?.method === 'DELETE'), false)
})
test('duplicate send requests result in one Gmail send', async () => {
  const { service, requests } = setup()
  try {
    await service.connect(); service.startDraft(); service.editDraft({ to: 'person@example.com' })
    await Promise.all([service.sendDraft(), service.sendDraft()])
    assert.equal(requests.filter(r => r.url.endsWith('/drafts/send')).length, 1); assert.equal(service.getSnapshot().editor, null)
  } finally { service.disconnect(true) }
})
test('send waits for an in-flight save and persists later edits before sending', async () => {
  const { service, requests } = setup()
  try {
    await service.connect(); service.startDraft(); service.editDraft({ to: 'person@example.com', body: 'First' })
    const saving = service.saveDraft(); service.editDraft({ body: 'Latest' })
    await service.sendDraft(); await saving
    const updates = requests.filter(r => r.init?.method === 'PUT')
    assert.equal(updates.length, 1); assert.equal(requests.filter(r => r.url.endsWith('/drafts/send')).length, 1)
  } finally { service.disconnect(true) }
})
test('ambiguous sending cannot be retried automatically or by another Send click', async () => {
  const { service, requests } = setup((url, init) => {
    if (url.endsWith('/drafts/send')) throw new TypeError('Network failed')
    if (url.endsWith('/drafts') && init?.method === 'POST') return response({ id: 'draft-1', message: message('r1') })
    return response({ id: 'draft-1', message: message('r1') })
  })
  try {
    await service.connect(); service.startDraft(); service.editDraft({ to: 'person@example.com' })
    await assert.rejects(service.sendDraft(), /request failed/)
    assert.equal(service.getSnapshot().editor?.status, 'uncertain'); await assert.rejects(service.sendDraft(), /Check Sent/)
    assert.equal(requests.filter(r => r.url.endsWith('/drafts/send')).length, 1)
  } finally { service.disconnect(true) }
})
test('draft conflict preserves editor and never overwrites Gmail', async () => {
  let revision = 'original'
  const { service, requests } = setup((url, init) => {
    if (url.endsWith('/drafts') && init?.method === 'POST') return response({ id: 'draft-1', message: message('original') })
    return response({ id: 'draft-1', message: message(revision) })
  })
  try {
    await service.connect(); service.startDraft(); await service.saveDraft(); revision = 'external'; service.editDraft({ body: 'Keep this' })
    await assert.rejects(service.saveDraft(), /changed in Gmail/)
    assert.equal(service.getSnapshot().editor?.draft.body, 'Keep this'); assert.equal(requests.some(r => r.init?.method === 'PUT'), false)
  } finally { service.disconnect(true) }
})
test('mutation failures do not trigger automatic retry', async () => {
  const { service, requests } = setup(() => response({}, 500))
  try { await service.connect(); await assert.rejects(service.action('m', 'trash')); assert.equal(requests.filter(r => r.url.endsWith('/trash')).length, 1) } finally { service.disconnect(true) }
})
test('pagination uses Gmail page tokens, scoped folders and bounded metadata loading', async () => {
  const { service, requests } = setup(url => url.includes('/messages?') ? response({ messages: [{ id: 'm1' }], nextPageToken: 'next' }) : response(message('m1')))
  try {
    await service.connect(); const result = await service.listMessages('Trash', 'from:friend@example.com', 'page')
    assert.equal(result.nextPageToken, 'next'); assert.equal(result.messages[0].message.id, 'm1')
    const url = new URL(requests[1].url); assert.equal(url.searchParams.get('pageToken'), 'page'); assert.equal(url.searchParams.get('includeSpamTrash'), 'true'); assert.match(url.searchParams.get('q')!, /in:trash/)
  } finally { service.disconnect(true) }
})
test('partial permission and cancelled popup leave Mail disconnected', async () => {
  const service = createMailService({ clientId: 'id', authorize: async () => ({ access_token: 'token', scope: 'openid' }), revoke: async () => {} })
  await assert.rejects(service.connect(), /Allow Gmail/); assert.equal(service.getSnapshot().status, 'disconnected')
  const api = { initTokenClient: (options: Parameters<MailIdentity['initTokenClient']>[0]) => ({ requestAccessToken: () => options.error_callback({ type: 'popup_closed' }) }), revoke() {} }
  await assert.rejects(requestMailToken(api, 'id'), /cancelled/)
})
test('different account cannot inherit the original unsaved draft', async () => {
  const { service, setIdentity } = setup()
  try { await service.connect(); service.startDraft(); setIdentity('other@example.com'); await assert.rejects(service.connect(), /original account/); assert.equal(service.getSnapshot().accountId, 'me@example.com') } finally { service.disconnect(true) }
})
test('Mail widgets share one extension switch and need no project; saved bindings keep identity', () => {
  for (const widget of ['mail-inbox', 'mail-message', 'mail-compose']) { assert.equal(extensionForWidget(widget), 'mail'); assert.equal(capabilityAllowed(widget, []), false); assert.equal(capabilityAllowed(widget, ['mail']), true) }
  const input = { goal: 'Show my inbox', enabledExtensions: ['mail' as const], referenceDate: '2026-10-11', timezone: 'Asia/Kolkata', catalog: { owners: [], projects: [], clients: [], draftKeys: [], topics: [] } }
  const resolution = fallbackComponentIntent(input); assert.equal(resolution.action, 'view')
  if (resolution.action !== 'view') return
  assert.equal(validateComponentResolution(resolution, input).success, true)
  const document = applyComponentView(emptyWorkspace(), resolution, input.goal, { kind: 'gmail', accountId: 'me@example.com' })
  assert.deepEqual(document.active[0].binding, { kind: 'gmail', accountId: 'me@example.com' })
  assert.equal(widgetInstanceSchema.safeParse(makeInstance('mail-compose')).success, true)
  const all = fallbackComponentIntent({ ...input, goal: 'Show all mails' }); assert.equal(all.action === 'view' && all.bindings.mailFolder, 'All Mail')
  const sent = fallbackComponentIntent({ ...input, goal: 'Show sent mail' }); assert.equal(sent.action === 'view' && sent.bindings.mailFolder, 'Sent')
  const write = fallbackComponentIntent({ ...input, goal: 'Write an email' }); assert.equal(write.action === 'view' && write.widgets[0], 'mail-compose')
  assert.ok(MailError.prototype instanceof Error)
})

test('draft validation failure is visible and never reaches Gmail', async () => {
  const { service, requests } = setup()
  try {
    await service.connect(); service.startDraft(); service.editDraft({ to: 'invalid recipient' })
    await assert.rejects(service.saveDraft(), /email addresses/)
    assert.match(service.getSnapshot().editor?.error ?? '', /email addresses/)
    assert.equal(requests.some(r => r.init?.method === 'POST'), false)
  } finally { service.disconnect(true) }
})
test('reopening a Gmail draft loads external text parts and binary attachments', async () => {
  const raw = message('draft-message', { mimeType: 'multipart/mixed', headers: [{ name: 'To', value: 'friend@example.com' }, { name: 'Subject', value: 'Saved draft' }], parts: [{ mimeType: 'text/plain', body: { attachmentId: 'text-body', size: 14 } }, { filename: 'report.pdf', mimeType: 'application/pdf', body: { attachmentId: 'file', size: 3 } }] })
  const { service } = setup(url => {
    if (url.includes('/drafts/d1?')) return response({ id: 'd1', message: raw })
    if (url.includes('/messages/draft-message?')) return response(raw)
    if (url.endsWith('/attachments/text-body')) return response({ data: base64url(new TextEncoder().encode('Saved content')) })
    if (url.endsWith('/attachments/file')) return response({ data: base64url(Uint8Array.from([0, 255, 80])) })
    throw new Error('Unexpected test request')
  })
  try {
    await service.connect(); await service.openDraft('d1')
    const editor = service.getSnapshot().editor!
    assert.equal(editor.draft.body, 'Saved content'); assert.equal(editor.draft.subject, 'Saved draft'); assert.equal(editor.revision, 'draft-message')
    assert.deepEqual(Array.from(editor.draft.attachments[0].bytes), [0, 255, 80]); assert.equal(service.hasUnsaved(), false)
  } finally { service.disconnect(true) }
})
test('cancelled mailbox reads cannot install stale results', async () => {
  const service = createMailService({ clientId: 'id', authorize: async () => ({ access_token: 'token', scope: GMAIL_SCOPE }), revoke: async () => {}, transport: (async (url, init) => {
    if (String(url).endsWith('/profile')) return response({ emailAddress: 'me@example.com' })
    return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }) })
  }) as typeof fetch })
  try {
    await service.connect(); const controller = new AbortController()
    const read = service.listMessages('Inbox', '', '', controller.signal); controller.abort()
    await assert.rejects(read, /request failed/)
    assert.equal(service.getSnapshot().status, 'connected')
  } finally { service.disconnect(true) }
})
test('mail commands with attachments select the composer rather than resource creation', () => {
  const input = { goal: 'Write an email with an attachment', enabledExtensions: ['mail' as const], referenceDate: '2026-10-11', timezone: 'Asia/Kolkata', catalog: { owners: [], projects: [], clients: [], draftKeys: [], topics: [] } }
  const result = fallbackComponentIntent(input)
  assert.equal(result.action, 'view'); if (result.action === 'view') assert.deepEqual(result.widgets, ['mail-compose'])
})

test('RFC 2047 headers decode folded UTF-8 and quoted-printable display names', () => {
  assert.equal(decodeMailHeader('=?UTF-8?B?4KSo4KSu4KS44KWN4KSk4KWH?=\r\n =?UTF-8?B?IPCfjIo=?='), 'नमस्ते 🌊')
  assert.equal(decodeMailHeader('=?ISO-8859-1?Q?Ol=E1?= <friend@example.com>'), 'Olá <friend@example.com>')
  assert.equal(decodeMailHeader('=?unsupported?B?AAAA?='), '=?unsupported?B?AAAA?=')
})
