import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { createAuth, getAuth, authenticatedUser } from './auth.ts'

const origin = 'http://localhost:3000'
const secret = 'test-only-0123456789-abcdefghijklmnopqrstuvwxyz'
const request = (path: string, body?: unknown, cookie?: string, requestOrigin = origin) => new Request(origin + '/api/auth/' + path, {
  method: body ? 'POST' : 'GET',
  headers: { ...(body ? { 'Content-Type': 'application/json', Origin: requestOrigin } : {}), ...(cookie ? { Cookie: cookie } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
})

test('SQLite auth migrates, persists a session across restart, and revokes it on sign-out', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orlo-auth-'))
  const env = { BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, AUTH_DB_PATH: join(directory, 'auth.sqlite') }
  let runtime = createAuth(env)
  try {
    await runtime.ready
    const signup = await runtime.auth.handler(request('sign-up/email', { name: 'Test user', email: 'test@example.com', password: 'test-password-123' }))
    assert.equal(signup.status, 200, await signup.clone().text())
    const cookie = signup.headers.getSetCookie().map((value: string) => value.split(';')[0]).join('; ')
    assert.ok(cookie)
    assert.match(signup.headers.getSetCookie().join(';'), /httponly/i)
    const before = await runtime.auth.api.getSession({ headers: new Headers({ cookie }) })
    assert.equal(before?.user.email, 'test@example.com')
    await runtime.close()
    runtime = createAuth(env)
    await runtime.ready
    const restored = await runtime.auth.api.getSession({ headers: new Headers({ cookie }) })
    assert.equal(restored?.user.id, before?.user.id)
    const signout = await runtime.auth.handler(request('sign-out', {}, cookie))
    assert.equal(signout.status, 200)
    assert.equal(await runtime.auth.api.getSession({ headers: new Headers({ cookie }) }), null)
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }) }
})

test('API authentication rejects anonymous and cross-origin writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'orlo-auth-'))
  const env = { BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: secret, AUTH_DB_PATH: join(directory, 'auth.sqlite') }
  const runtime = getAuth(env)
  try {
    await runtime.ready
    const req = (method: string, cookie?: string, requestOrigin = origin) => ({ method, headers: { origin: requestOrigin, ...(cookie ? { cookie } : {}) } }) as IncomingMessage
    await assert.rejects(authenticatedUser(req('GET'), env), { status: 401 })
    const signup = await runtime.auth.handler(request('sign-up/email', { name: 'Owner', email: 'owner@example.com', password: 'test-password-123' }))
    assert.equal(signup.status, 200)
    const cookie = signup.headers.getSetCookie().map((value: string) => value.split(';')[0]).join('; ')
    assert.ok(await authenticatedUser(req('GET', cookie), env))
    await assert.rejects(authenticatedUser(req('POST', cookie, 'https://unrelated.example'), env), { status: 403 })
    assert.ok(await authenticatedUser(req('POST', cookie), env))
  } finally { await runtime.close(); await rm(directory, { recursive: true, force: true }) }
})

test('auth configuration rejects short secrets and unsafe public HTTP origins', () => {
  assert.throws(() => createAuth({ BETTER_AUTH_SECRET: 'short' }), { status: 503 })
  assert.throws(() => createAuth({ NODE_ENV: 'production', BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: 'http://public.example' }), { status: 503 })
})
