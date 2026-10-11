import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { CalendarEvent, EventDraft } from '../../src/domain/calendar.ts'

export type Connection = { accessToken: string; refreshToken: string; expires: number; scope: string; accountId: string; email: string }
export type Operation = { id: string; draft: EventDraft; expires: number; state: 'draft' | 'pending' | 'created'; event?: CalendarEvent }
export type Session = { expires: number; oauth?: { state: string; verifier: string; expires: number }; connection?: Connection; operations: Record<string, Operation> }
export function createCalendarStore(env: NodeJS.ProcessEnv) {
  const directory = env.CALENDAR_DATA_DIR ?? resolve('server/.calendar-data')
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  const keyPath = resolve(directory, 'encryption.key')
  if (env.NODE_ENV === 'production' && !env.CALENDAR_TOKEN_KEY) throw new Error('Configure CALENDAR_TOKEN_KEY for production.')
  if (!env.CALENDAR_TOKEN_KEY && !existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: 'wx' })
  const key = env.CALENDAR_TOKEN_KEY ? Buffer.from(env.CALENDAR_TOKEN_KEY, 'hex') : readFileSync(keyPath)
  if (key.length !== 32) throw new Error('CALENDAR_TOKEN_KEY must contain 64 hexadecimal characters.')
  const filename = resolve(directory, 'sessions.enc')
  let sessions: Record<string, Session> = {}
  if (existsSync(filename)) {
    const data = readFileSync(filename)
    const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
    decipher.setAuthTag(data.subarray(12, 28))
    sessions = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString())
  }
  function save() {
    for (const [id, session] of Object.entries(sessions)) if (session.expires < Date.now()) delete sessions[id]
    const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(sessions)), cipher.final()])
    mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
    writeFileSync(filename + '.tmp', Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 })
    renameSync(filename + '.tmp', filename)
  }
  return {
    get(id: string) { const session = sessions[id]; return session?.expires > Date.now() ? session : null },
    create() { const id = randomBytes(32).toString('hex'); const session: Session = { expires: Date.now() + 7 * 86400000, operations: {} }; sessions[id] = session; save(); return { id, session } },
    save,
  }
}
