import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMailCache, MAIL_CACHE_TTL, mailCacheKey } from '../src/extensions/mail/mailCache.ts'
import { createMailService } from '../src/extensions/mail/mailService.ts'
import { GMAIL_SCOPE, normalizeMail } from '../src/domain/mail.ts'
function memory() {
  const values = new Map<string, string>()
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } }
}
const rawMessage = (id: string) => ({ id, threadId: id, labelIds: ['INBOX'], snippet: 'Preview', payload: { headers: [{ name: 'Subject', value: 'Subject ' + id }], mimeType: 'text/plain', body: { data: btoa('Private body') } } })
const page = { messages: [{ message: normalizeMail(rawMessage('one')) }], nextPageToken: 'next' }
test('list cache is account/query/page scoped, expires and excludes full message content', () => {
  const { storage, values } = memory(); let clock = 100
  const cache = createMailCache(() => storage, () => clock)
  cache.set('a@example.com', 'Inbox', 'subject:test', '', page)
  assert.equal(cache.get('a@example.com', 'Inbox', 'subject:test', '')?.messages[0].message.id, 'one')
  assert.equal(cache.get('b@example.com', 'Inbox', 'subject:test', ''), undefined)
  assert.equal(cache.get('a@example.com', 'Sent', 'subject:test', ''), undefined)
  assert.equal(cache.get('a@example.com', 'Inbox', '', ''), undefined)
  assert.equal(cache.get('a@example.com', 'Inbox', 'subject:test', 'next'), undefined)
  assert.ok(!values.get(mailCacheKey)!.includes('Private body'))
  assert.equal(cache.get('a@example.com', 'Inbox', 'subject:test', '')?.messages[0].message.text, '')
  clock += MAIL_CACHE_TTL; assert.equal(cache.get('a@example.com', 'Inbox', 'subject:test', ''), undefined)
})
test('malformed/blocked/quota storage falls back and failed clear does not reuse old entries', () => {
  const { storage, values } = memory(), cache = createMailCache(() => storage)
  values.set(mailCacheKey, '{'); assert.equal(cache.get('a', 'Inbox', '', ''), undefined)
  cache.set('a', 'Inbox', '', '', page); assert.ok(cache.get('a', 'Inbox', '', ''))
  storage.removeItem = () => { throw new Error('blocked') }
  cache.clear(); assert.equal(cache.get('a', 'Inbox', '', ''), undefined)
  const blocked = createMailCache(() => { throw new Error('blocked') })
  assert.doesNotThrow(() => blocked.set('a', 'Inbox', '', '', page)); assert.equal(blocked.get('a', 'Inbox', '', ''), undefined)
  assert.doesNotThrow(() => blocked.clear())
})
test('cache stays bounded to twenty five-message pages', () => {
  const { storage, values } = memory(), cache = createMailCache(() => storage)
  for (let i = 0; i < 30; i++) cache.set('a', 'Inbox', String(i), '', { messages: Array.from({ length: 8 }, (_, j) => ({ message: normalizeMail(rawMessage(String(j))) })) })
  const saved = JSON.parse(values.get(mailCacheKey)!)
  assert.equal(saved.pages.length, 20); assert.equal(saved.pages[0].messages.length, 5)
})
test('five-message requests reuse persistent cache and concurrent calls; refresh, edits and disconnect invalidate it', async () => {
  const { storage, values } = memory(); let clock = 100, lists = 0, metadata = 0
  const cache = createMailCache(() => storage, () => clock)
  const serviceOptions = {
    clientId: 'test', cache, now: () => clock,
    authorize: async () => ({ access_token: 'private-token', expires_in: 3600, scope: GMAIL_SCOPE }), revoke: async () => {},
    transport: (async (url: string | URL | Request) => {
      const path = new URL(String(url))
      if (path.pathname.endsWith('/profile')) return Response.json({ emailAddress: 'a@example.com' })
      if (path.pathname.endsWith('/messages')) { lists++; assert.equal(path.searchParams.get('maxResults'), '5'); return Response.json({ messages: Array.from({ length: 7 }, (_, i) => ({ id: String(i) })), nextPageToken: 'next' }) }
      if (path.pathname.endsWith('/modify')) return Response.json({})
      metadata++; return Response.json(rawMessage(path.pathname.split('/').at(-1)!))
    }) as typeof fetch,
  }
  const service = createMailService(serviceOptions), reloaded = createMailService(serviceOptions)
  try {
    await service.connect()
    const [first, second] = await Promise.all([service.listMessages('Inbox'), service.listMessages('Inbox')])
    assert.equal(first.messages.length, 5); assert.deepEqual(first, second); assert.equal(lists, 1); assert.equal(metadata, 5)
    await service.listMessages('Inbox'); assert.equal(lists, 1)
    await reloaded.connect(); await reloaded.listMessages('Inbox'); assert.equal(lists, 1)
    assert.ok(!JSON.stringify([...values]).includes('private-token')); assert.ok(!JSON.stringify([...values]).includes('Private body'))
    clock += MAIL_CACHE_TTL; await service.listMessages('Inbox'); assert.equal(lists, 2)
    service.refresh(); await service.listMessages('Inbox'); assert.equal(lists, 3)
    await service.action('0', 'read'); await service.listMessages('Inbox'); assert.equal(lists, 4)
    await service.listMessages('Sent'); await service.listMessages('Inbox', 'test'); await service.listMessages('Inbox', '', 'next'); assert.equal(lists, 7)
    service.disconnect(); assert.equal(values.has(mailCacheKey), false)
  } finally { service.disconnect(true); reloaded.disconnect(true) }
})
test('a refresh during a list request prevents stale cache installation', async () => {
  const { storage } = memory(), cache = createMailCache(() => storage)
  let release = (_response: Response) => {}
  const service = createMailService({ clientId: 'id', cache, authorize: async () => ({ access_token: 'token', scope: GMAIL_SCOPE }), revoke: async () => {}, transport: (async url => String(url).endsWith('/profile') ? Response.json({ emailAddress: 'a@example.com' }) : new Promise<Response>(resolve => { release = resolve })) as typeof fetch })
  try {
    await service.connect(); const pending = service.listMessages('Inbox'); service.refresh(); release(Response.json({ messages: [] }))
    await assert.rejects(pending, /changed while loading/); assert.equal(cache.get('a@example.com', 'Inbox', '', ''), undefined)
  } finally { service.disconnect(true) }
})
test('message cache expires, isolates callers and rejects reads invalidated by refresh', async () => {
  let clock = 100, reads = 0, hold = false, prepared = 0
  let release = (_response: Response) => {}
  const service = createMailService({ clientId: 'id', now: () => clock, prepare: async () => { prepared++ }, authorize: async () => ({ access_token: 'token', scope: GMAIL_SCOPE }), revoke: async () => {}, transport: (async url => {
    if (String(url).endsWith('/profile')) return Response.json({ emailAddress: 'a@example.com' })
    reads++
    return hold ? new Promise<Response>(resolve => { release = resolve }) : Response.json(rawMessage('one'))
  }) as typeof fetch })
  try {
    await service.prepare(); assert.equal(prepared, 1)
    await service.connect()
    const first = await service.getMessage('one'); first.subject = 'Mutated'
    assert.equal((await service.getMessage('one')).subject, 'Subject one'); assert.equal(reads, 1)
    clock += MAIL_CACHE_TTL; await service.getMessage('one'); assert.equal(reads, 2)
    service.refresh(); hold = true
    const pending = service.getMessage('one'); service.refresh(); release(Response.json(rawMessage('one')))
    await assert.rejects(pending, /changed while loading/)
    hold = false; await service.getMessage('one'); assert.equal(reads, 4)
  } finally { service.disconnect(true) }
})
