import { calendarCapabilities } from './calendar/permissions.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCalendarHandler } from './calendar/handler.ts'
import { createCalendarStore } from './calendar/store.ts'
import { createGoogleProvider, normalizeGoogleEvent } from './calendar/google.ts'
import { calendarWindow, zonedInstant, shiftDate, eventDraftSchema } from '../src/domain/calendar.ts'
const readScope = 'https://www.googleapis.com/auth/calendar.events.readonly', writeScope = 'https://www.googleapis.com/auth/calendar.events'
const draft = { title: 'Review with Alex', description: 'Review the plan', start: '2100-01-02T10:00:00Z', end: '2100-01-02T10:30:00Z', timezone: 'UTC', attendees: ['alex@example.com'] }
const item = { id: 'meeting-a', summary: 'Planning meeting', etag: 'revision-1', start: { dateTime: draft.start, timeZone: 'UTC' }, end: { dateTime: draft.end, timeZone: 'UTC' }, attendees: [{ email: 'alex@example.com' }], status: 'confirmed' }
function harness() {
  const directory = mkdtempSync(join(tmpdir(), 'orlo-calendar-test-'))
  const env = { GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'http://localhost:5173/api/calendar/google/callback', APP_ORIGIN: 'http://localhost:5173', CALENDAR_DATA_DIR: directory }
  const state = { scope: readScope + ' ' + writeScope, calls: 0, creates: 0, conflict: false, uncertain: false, revoked: false }
  const created = new Map<string, Record<string, unknown>>()
  const transport: typeof fetch = async (input, init) => {
    state.calls++
    const url = new URL(String(input))
    if (url.pathname === '/token') return Response.json({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, scope: state.scope })
    if (url.pathname === '/v1/userinfo') return Response.json({ sub: 'account-a', email: 'owner@example.com', email_verified: true })
    if (url.pathname === '/revoke') { state.revoked = true; return new Response('', { status: 200 }) }
    if (url.pathname.endsWith('/events') && init?.method === 'POST') {
      state.creates++
      const value = JSON.parse(String(init.body)) as Record<string, unknown>
      created.set(String(value.id), { ...value, etag: 'created', status: 'confirmed' })
      if (state.uncertain) throw new TypeError('simulated lost response')
      return Response.json(created.get(String(value.id)))
    }
    if (url.pathname.endsWith('/events')) return Response.json({ items: state.conflict ? [item] : [] })
    if (url.pathname.includes('/events/')) { const id = decodeURIComponent(url.pathname.split('/').at(-1)!); return id === 'meeting-a' ? Response.json(item) : created.has(id) ? Response.json(created.get(id)) : new Response('', { status: 404 }) }
    throw new Error('Unexpected test transport')
  }
  const handler = createCalendarHandler(env, transport)
  async function invoke(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
    const req = Readable.from(options.body === undefined ? [] : [Buffer.from(JSON.stringify(options.body))]) as unknown as IncomingMessage
    req.method = options.method ?? 'GET'; req.url = path
    req.headers = { cookie: options.cookie ?? '', origin: options.origin ?? env.APP_ORIGIN, 'x-orlo-request': '1', 'content-type': 'application/json' }
    let status = 0, output = ''
    const headers: Record<string, unknown> = {}
    const res = Object.assign(new EventEmitter(), { headersSent: false, writableEnded: false, setHeader(key: string, value: unknown) { headers[key.toLowerCase()] = value }, writeHead(code: number, values: Record<string, unknown>) { status = code; Object.assign(headers, Object.fromEntries(Object.entries(values).map(([k,v]) => [k.toLowerCase(),v]))); this.headersSent = true }, end(value = '') { output = value; this.writableEnded = true } })
    const handled = await handler(req, res as unknown as ServerResponse)
    return { handled, status, headers, body: output ? JSON.parse(output) : null, cookie: String(headers['set-cookie'] ?? '').split(';')[0] }
  }
  async function authorize() {
    const start = await invoke('/api/calendar/google/connect')
    const nonce = new URL(String(start.headers.location)).searchParams.get('state')
    const result = await invoke('/api/calendar/google/callback?code=test-code&state=' + nonce, { cookie: start.cookie })
    assert.equal(result.status, 302)
    return result.cookie
  }
  return { invoke, authorize, env, directory, state }
}
test('status exposes no credentials and other API routes are untouched', async () => {
  const h = harness(), status = await h.invoke('/api/calendar/connections')
  assert.equal(status.body.connected, false); assert.equal(status.body.configured, true)
  assert.ok(!JSON.stringify(status.body).includes('test-secret')); assert.equal((await h.invoke('/api/generate')).handled, false)
})
test('OAuth uses PKCE, offline access, callback and HttpOnly cookie', async () => {
  const h = harness(), start = await h.invoke('/api/calendar/google/connect'), url = new URL(String(start.headers.location))
  assert.equal(url.searchParams.get('redirect_uri'), h.env.GOOGLE_REDIRECT_URI)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256'); assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.match(String(start.headers['set-cookie']), /HttpOnly/); assert.equal(h.state.calls, 0)
})
test('bad OAuth state is rejected before provider access', async () => {
  const h = harness(), start = await h.invoke('/api/calendar/google/connect')
  const blocked = await h.invoke('/api/calendar/google/callback?code=test&state=bad', { cookie: start.cookie })
  assert.equal(blocked.status, 302); assert.match(String(blocked.headers.location), /calendar=state-error/); assert.equal(h.state.calls, 0)
})
test('OAuth rotates sessions and prevents callback replay', async () => {
  const h = harness(), start = await h.invoke('/api/calendar/google/connect'), nonce = new URL(String(start.headers.location)).searchParams.get('state'), path = '/api/calendar/google/callback?code=test&state=' + nonce
  const authenticated = await h.invoke(path, { cookie: start.cookie })
  assert.notEqual(authenticated.cookie, start.cookie)
  assert.equal((await h.invoke('/api/calendar/connections', { cookie: start.cookie })).body.connected, false)
  assert.equal((await h.invoke('/api/calendar/connections', { cookie: authenticated.cookie })).body.email, 'owner@example.com')
  assert.match(String((await h.invoke(path, { cookie: start.cookie })).headers.location), /calendar=state-error/)
})
test('OAuth denial returns to the workspace without connecting', async () => {
  const h = harness(), start = await h.invoke('/api/calendar/google/connect'), nonce = new URL(String(start.headers.location)).searchParams.get('state')
  const result = await h.invoke('/api/calendar/google/callback?error=access_denied&state=' + nonce, { cookie: start.cookie })
  assert.match(String(result.headers.location), /calendar=denied/); assert.equal(h.state.calls, 0)
})
test('encrypted tokens survive restart without plaintext secrets', async () => {
  const h = harness(), cookie = await h.authorize(), bytes = readFileSync(join(h.directory, 'sessions.enc'))
  assert.ok(!bytes.toString().includes('test-refresh')); assert.ok(!bytes.toString().includes('owner@example.com'))
  assert.equal(createCalendarStore(h.env).get(cookie.split('=')[1])?.connection?.email, 'owner@example.com')
})
test('event access needs a session and POST rejects foreign origins', async () => {
  const h = harness(), cookie = await h.authorize()
  assert.equal((await h.invoke('/api/calendar/events?from=2100-01-02T00:00:00Z&to=2100-01-03T00:00:00Z')).status, 401)
  assert.equal((await h.invoke('/api/calendar/event-drafts', { method: 'POST', body: draft, cookie, origin: 'https://other.example' })).status, 403)
})
test('event reading validates date windows and returns actual attendees', async () => {
  const h = harness(), cookie = await h.authorize()
  assert.equal((await h.invoke('/api/calendar/events?from=bad&to=bad', { cookie })).status, 400)
  const result = await h.invoke('/api/calendar/events/meeting-a', { cookie })
  assert.equal(result.body.event.title, 'Planning meeting'); assert.equal(result.body.event.attendees[0].email, 'alex@example.com')
})
test('disconnect revokes the grant and removes calendar access', async () => {
  const h = harness(), cookie = await h.authorize()
  assert.equal((await h.invoke('/api/calendar/google/disconnect', { method: 'POST', cookie, body: {} })).status, 200)
  assert.equal(h.state.revoked, true); assert.equal((await h.invoke('/api/calendar/connections', { cookie })).body.connected, false)
})
test('preview makes no external event; repeated confirmation creates one', async () => {
  const h = harness(), cookie = await h.authorize(), preview = await h.invoke('/api/calendar/event-drafts', { method: 'POST', cookie, body: draft })
  assert.equal(h.state.creates, 0)
  const path = '/api/calendar/event-drafts/' + preview.body.id + '/confirm'
  const first = await h.invoke(path, { method: 'POST', cookie, body: {} }), second = await h.invoke(path, { method: 'POST', cookie, body: {} })
  assert.equal(first.body.state, 'created'); assert.equal(first.body.event.id, second.body.event.id); assert.equal(h.state.creates, 1)
})
test('read-only permission and a changed calendar prevent creation', async () => {
  const h = harness(); h.state.scope = readScope
  const cookie = await h.authorize(), preview = await h.invoke('/api/calendar/event-drafts', { method: 'POST', cookie, body: draft })
  assert.equal((await h.invoke('/api/calendar/event-drafts/' + preview.body.id + '/confirm', { method: 'POST', cookie, body: {} })).status, 403); assert.equal(h.state.creates, 0)
  const h2 = harness(), cookie2 = await h2.authorize(); h2.state.conflict = true
  const preview2 = await h2.invoke('/api/calendar/event-drafts', { method: 'POST', cookie: cookie2, body: draft })
  assert.equal((await h2.invoke('/api/calendar/event-drafts/' + preview2.body.id + '/confirm', { method: 'POST', cookie: cookie2, body: {} })).status, 409); assert.equal(h2.state.creates, 0)
})
test('lost creation response is reconciled without a duplicate write', async () => {
  const h = harness(), cookie = await h.authorize(); h.state.uncertain = true
  const preview = await h.invoke('/api/calendar/event-drafts', { method: 'POST', cookie, body: draft }), path = '/api/calendar/event-drafts/' + preview.body.id + '/confirm'
  assert.equal((await h.invoke(path, { method: 'POST', cookie, body: {} })).status, 502)
  assert.equal((await h.invoke(path, { method: 'POST', cookie, body: {} })).body.state, 'created'); assert.equal(h.state.creates, 1)
})
test('another session cannot confirm a private event preview', async () => {
  const h = harness(), cookie = await h.authorize(), preview = await h.invoke('/api/calendar/event-drafts', { method: 'POST', cookie, body: draft }), other = await h.authorize()
  assert.equal((await h.invoke('/api/calendar/event-drafts/' + preview.body.id + '/confirm', { method: 'POST', cookie: other, body: {} })).status, 404)
})
test('availability excludes occupied slots and labels guest availability unknown', async () => {
  const h = harness(), cookie = await h.authorize(); h.state.conflict = true
  const result = await h.invoke('/api/calendar/availability', { method: 'POST', cookie, body: { date: '2100-01-02', duration: 30, timezone: 'UTC' } })
  assert.equal(result.status, 200); assert.match(result.body.notice, /unknown/)
  assert.ok(!result.body.slots.some((slot: { start: string }) => Date.parse(slot.start) === Date.parse(draft.start)))
})
test('normalization preserves all-day, overnight and recurrence identity', () => {
  assert.equal(normalizeGoogleEvent({ ...item, status: 'cancelled' }), null)
  const allDay = normalizeGoogleEvent({ ...item, start: { date: '2100-01-02' }, end: { date: '2100-01-04' } })!
  assert.equal(allDay.allDay, true); assert.equal(allDay.end, '2100-01-04')
  assert.equal(normalizeGoogleEvent({ ...item, id: 'instance-2', recurringEventId: 'series', end: { dateTime: '2100-01-03T01:00:00Z' } })!.id, 'instance-2')
})
test('timezone math handles midnight, year changes and DST-sized days', () => {
  assert.equal(zonedInstant('2026-10-12', '00:00', 'Asia/Kolkata'), '2026-10-11T18:30:00.000Z'); assert.equal(shiftDate('2026-12-31', 1), '2027-01-01')
  const spring = calendarWindow('2026-03-08', 'America/New_York'); assert.equal((Date.parse(spring.to) - Date.parse(spring.from)) / 3600000, 23)
  assert.throws(() => zonedInstant('2026-03-08', '02:30', 'America/New_York'))
})
test('draft validation rejects invalid email and reversed times', () => {
  assert.equal(eventDraftSchema.safeParse({ ...draft, attendees: ['Alex'] }).success, false); assert.equal(eventDraftSchema.safeParse({ ...draft, end: draft.start }).success, false)
})
test('real preparation uses authoritative events and a deterministic layout without AI credentials', async () => {
  const h = harness(), cookie = await h.authorize()
  const result = await h.invoke('/api/calendar/preparation', { method: 'POST', cookie, body: { eventId: 'meeting-a', goal: 'Prepare for this meeting' } })
  assert.equal(result.status, 200); assert.equal(result.body.source, 'local')
  assert.equal(result.body.event.title, 'Planning meeting')
  assert.deepEqual(result.body.widgets, ['details', 'outline', 'calendar'])
  assert.equal(h.state.creates, 0)
})

test('expired access tokens refresh once and save the new token', async () => {
  let refreshes = 0, saves = 0
  const connection = { accountId: 'refresh-test', email: 'owner@example.com', accessToken: 'expired', refreshToken: 'refresh-secret', expires: 0, scope: readScope }
  const provider = createGoogleProvider({ GOOGLE_CLIENT_ID: 'test-id', GOOGLE_CLIENT_SECRET: 'test-secret' }, () => { saves++ }, async (input, options) => {
    if (String(input).includes('oauth2.googleapis.com/token')) { refreshes++; assert.match(String(options?.body), /grant_type=refresh_token/); return Response.json({ access_token: 'fresh', expires_in: 3600 }) }
    assert.ok(options && options.headers)
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer fresh')
    return Response.json({ items: [] })
  })
  await Promise.all([provider.events(connection, draft.start, draft.end, 'UTC'), provider.events(connection, draft.start, draft.end, 'UTC')])
  assert.equal(refreshes, 1); assert.equal(saves, 1); assert.equal(connection.accessToken, 'fresh')
})
test('calendar pagination deduplicates events without losing recurrence instances', async () => {
  let pages = 0
  const connection = { accountId: 'paging-test', email: 'owner@example.com', accessToken: 'test-access', refreshToken: 'test-refresh', expires: Date.now() + 3600000, scope: readScope }
  const provider = createGoogleProvider({}, () => {}, async input => {
    const url = new URL(String(input)); pages++
    assert.equal(url.searchParams.get('singleEvents'), 'true')
    return url.searchParams.get('pageToken') ? Response.json({ items: [item, { ...item, id: 'instance-b' }] }) : Response.json({ items: [item], nextPageToken: 'page-two' })
  })
  const records = await provider.events(connection, draft.start, draft.end, 'UTC')
  assert.equal(pages, 2); assert.deepEqual(records.map(e => e.id), ['meeting-a', 'instance-b'])
})
test('malformed availability inputs return 400 rather than a provider error', async () => {
  const h = harness(), cookie = await h.authorize()
  assert.equal((await h.invoke('/api/calendar/availability', { method: 'POST', cookie, body: { date: '2026-02-31', timezone: 'UTC', duration: 30 } })).status, 400)
  assert.equal((await h.invoke('/api/calendar/availability', { method: 'POST', cookie, body: { date: '2100-01-02', timezone: 'Invalid/Timezone', duration: 30 } })).status, 400)
})

test('calendar permissions accept equivalent broader scopes without treating sign-in as calendar access', () => {
  assert.deepEqual(calendarCapabilities('openid email profile'), { read: false, write: false })
  assert.deepEqual(calendarCapabilities(readScope), { read: true, write: false })
  assert.deepEqual(calendarCapabilities('https://www.googleapis.com/auth/calendar.readonly'), { read: true, write: false })
  assert.deepEqual(calendarCapabilities('https://www.googleapis.com/auth/calendar'), { read: true, write: true })
  assert.deepEqual(calendarCapabilities(undefined), { read: false, write: false })
})
test('sign-in without calendar permission returns helpful recovery inside the app, not raw JSON', async () => {
  const h = harness(); h.state.scope = 'openid email profile'
  const start = await h.invoke('/api/calendar/google/connect')
  const nonce = new URL(String(start.headers.location)).searchParams.get('state')
  const callback = await h.invoke('/api/calendar/google/callback?code=test&state=' + nonce, { cookie: start.cookie })
  assert.equal(callback.status, 302); assert.match(String(callback.headers.location), /calendar=permission-missing/)
  assert.equal(callback.body, null)
  assert.equal((await h.invoke('/api/calendar/connections', { cookie: start.cookie })).body.connected, false)
  assert.equal(h.state.creates, 0)
})
