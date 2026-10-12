import mongoose, { Schema } from 'mongoose'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { GMAIL_SCOPE } from '../../client/src/domain/mail.ts'
import { BackendError } from './repository.ts'
import { readJson, sendJson } from './api.ts'

const connectionSchema = new Schema({ _id: String, encrypted: String, email: String, expiresAt: Date, revision: Number }, { versionKey: false })
const cacheSchema = new Schema({ _id: String, userId: String, payload: Schema.Types.Mixed, expiresAt: Date }, { versionKey: false })
cacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); cacheSchema.index({ userId: 1 })
const connections = mongoose.models.Orlo_mailConnection ?? mongoose.model('Orlo_mailConnection', connectionSchema, 'mailConnections')
const cache = mongoose.models.Orlo_mailCache ?? mongoose.model('Orlo_mailCache', cacheSchema, 'mailCache')
export function mailPathAllowed(path: string, method: string) {
  const url = new URL(path, 'https://gmail.googleapis.com/')
  if (url.origin !== 'https://gmail.googleapis.com' || /%|\.\./.test(url.pathname)) return false
  const route = url.pathname.slice(1), id = '[A-Za-z0-9_-]+'
  const rules: Record<string, RegExp> = {
    GET: new RegExp(`^(profile|messages|drafts|messages/${id}|drafts/${id}|messages/${id}/attachments/${id})$`),
    POST: new RegExp(`^(drafts|drafts/send|messages/${id}/(modify|trash|untrash))$`),
    PUT: new RegExp(`^drafts/${id}$`), DELETE: new RegExp(`^drafts/${id}$`),
  }
  if (!rules[method]?.test(route)) return false
  const allowed = ['format', 'metadataHeaders', 'q', 'pageToken', 'maxResults', 'includeSpamTrash']
  if ([...url.searchParams.keys()].some(key => !allowed.includes(key))) return false
  const limit = url.searchParams.get('maxResults')
  return limit === null || /^[1-5]$/.test(limit)
}
export function mailTokenCipher(secret: string) {
  const key = createHash('sha256').update('orlo-mail:' + secret).digest()
  return {
    encrypt(token: string) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(token), cipher.final(), cipher.getAuthTag()]).toString('base64') },
    decrypt(value: string) { const bytes = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(-16)); return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]).toString() },
  }
}
const tokenInput = z.strictObject({ access_token: z.string().min(1).max(4096), expires_in: z.number().int().min(1).max(86400), scope: z.string().max(2000) })
export async function mailEndpoint(req: IncomingMessage, res: ServerResponse, env: NodeJS.ProcessEnv, userId: string) {
  const url = new URL(req.url ?? '/', 'http://localhost'), path = url.pathname
  if (!path.startsWith('/api/mail/')) return false
  const cipher = mailTokenCipher(env.BETTER_AUTH_SECRET!)
  if (path === '/api/mail/connection' && req.method === 'POST') {
    const input = tokenInput.parse(await readJson(req))
    if (!input.scope.split(/\s+/).includes(GMAIL_SCOPE)) throw new BackendError(403, 'Allow Gmail read and modify access.')
    const upstream = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: 'Bearer ' + input.access_token }, signal: AbortSignal.timeout(20000) })
    if (!upstream.ok) throw new BackendError(upstream.status, 'Google could not verify this Gmail connection.')
    const profile = z.object({ emailAddress: z.email() }).parse(await upstream.json())
    await connections.updateOne({ _id: userId }, { $set: { encrypted: cipher.encrypt(input.access_token), email: profile.emailAddress, expiresAt: new Date(Date.now() + input.expires_in * 1000) }, $inc: { revision: 1 } }, { upsert: true })
    await cache.deleteMany({ userId })
    sendJson(res, 200, { email: profile.emailAddress, expires_in: input.expires_in }); return true
  }
  const connection = await connections.findById(userId).lean() as { encrypted: string; email: string; expiresAt: Date; revision: number } | null
  if (path === '/api/mail/connection' && req.method === 'GET') {
    sendJson(res, 200, connection && connection.expiresAt.getTime() > Date.now() + 5000 ? { connected: true, email: connection.email, expires_in: Math.floor((connection.expiresAt.getTime() - Date.now()) / 1000) } : { connected: false }); return true
  }
  if (path === '/api/mail/connection' && req.method === 'DELETE') {
    await connections.deleteOne({ _id: userId }); await cache.deleteMany({ userId }); sendJson(res, 200, { ok: true }); return true
  }
  if (!connection || connection.expiresAt.getTime() <= Date.now() + 5000) throw new BackendError(401, 'Reconnect Gmail to continue.')
  const token = cipher.decrypt(connection.encrypted)
  if (path === '/api/mail/revoke' && req.method === 'POST') {
    const revoked = await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(20000) })
    if (!revoked.ok) throw new BackendError(502, 'Google could not revoke this connection.')
    await connections.deleteOne({ _id: userId }); await cache.deleteMany({ userId }); sendJson(res, 200, { ok: true }); return true
  }
  const prefix = '/api/mail/gmail/', upstreamPath = path.slice(prefix.length) + url.search, method = req.method ?? 'GET'
  if (!path.startsWith(prefix) || !mailPathAllowed(upstreamPath, method)) throw new BackendError(400, 'Unsupported Gmail operation.')
  const key = createHash('sha256').update(JSON.stringify([userId, connection.email, connection.revision, upstreamPath])).digest('hex')
  if (method === 'GET') {
    const cached = await cache.findOne({ _id: key, userId, expiresAt: { $gt: new Date() } }).lean() as { payload: unknown } | null
    if (cached) { sendJson(res, 200, cached.payload); return true }
  } else {
    // Advance before the request so a slow read cannot populate the next revision's cache.
    await connections.updateOne({ _id: userId }, { $inc: { revision: 1 } }); await cache.deleteMany({ userId })
  }
  const body = method !== 'GET' && method !== 'DELETE' ? JSON.stringify(await readJson(req)) : undefined
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + upstreamPath, { method, headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body, signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new BackendError(response.status, 'Gmail could not complete this operation.')
  const payload = response.status === 204 ? null : await response.json()
  if (method === 'GET') await cache.updateOne({ _id: key }, { $set: { userId, payload, expiresAt: new Date(Date.now() + 300000) } }, { upsert: true })
  sendJson(res, 200, payload); return true
}
