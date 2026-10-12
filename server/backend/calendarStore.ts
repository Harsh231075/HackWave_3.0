import mongoose, { Schema } from 'mongoose'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import type { Session } from '../calendar/store.ts'
import { BackendError } from './repository.ts'

const schema = new Schema({ _id: String, userId: { type: String, required: true, immutable: true }, encrypted: { type: String, required: true }, revision: Number, expiresAt: Date }, { versionKey: false })
schema.index({ userId: 1 }); schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const model = mongoose.models.Orlo_calendar ?? mongoose.model('Orlo_calendar', schema, 'calendarConnections')
export function calendarCookie(cookie?: string) { return cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('orlo_calendar='))?.slice(14) ?? '' }
export async function calendarOwner(id: string) {
  const record = await model.findOne({ _id: id, expiresAt: { $gt: new Date() } }).lean() as { userId: string } | null
  return record?.userId
}
export function createMongoCalendarStore(userId: string, env: NodeJS.ProcessEnv) {
  if (!/^[a-f\d]{64}$/i.test(env.CALENDAR_TOKEN_KEY ?? '')) throw new BackendError(503, 'Configure CALENDAR_TOKEN_KEY (64 hex characters) on the server.')
  const key = Buffer.from(env.CALENDAR_TOKEN_KEY!, 'hex')
  const loaded = new Map<string, { session: Session; revision: number; original: string }>()
  function encrypt(session: Session) { const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64') }
  function decrypt(value: string): Session { const bytes = Buffer.from(value, 'base64'), cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString()) as Session }
  return {
    async get(id: string) {
      if (loaded.has(id)) return loaded.get(id)!.session
      const record = await model.findOne({ _id: id, userId, expiresAt: { $gt: new Date() } }).lean() as { encrypted: string; revision: number } | null
      if (!record) return null
      const session = decrypt(record.encrypted)
      loaded.set(id, { session, revision: record.revision, original: JSON.stringify(session) }); return session
    },
    async create() {
      const id = randomBytes(32).toString('hex'), session: Session = { expires: Date.now() + 7 * 86400000, operations: {} }
      await model.create({ _id: id, userId, encrypted: encrypt(session), revision: 0, expiresAt: new Date(session.expires) })
      loaded.set(id, { session, revision: 0, original: JSON.stringify(session) }); return { id, session }
    },
    async save() {
      for (const [id, value] of loaded) {
        const next = JSON.stringify(value.session)
        if (next === value.original) continue
        const result = await model.updateOne({ _id: id, userId, revision: value.revision }, { $set: { encrypted: encrypt(value.session), expiresAt: new Date(value.session.expires) }, $inc: { revision: 1 } })
        if (!result.modifiedCount) throw new BackendError(409, 'Calendar connection changed. Retry this request.')
        value.revision++; value.original = next
      }
    },
  }
}
