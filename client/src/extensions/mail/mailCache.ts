import { z } from 'zod'
import type { MailFolder, MailMessage } from '../../domain/mail.ts'

export const MAIL_PAGE_SIZE = 5
export const MAIL_CACHE_TTL = 5 * 60 * 1000
export const mailCacheKey = 'orlo-mail-cache-v1'
export type MailListPage = { messages: { message: MailMessage; draftId?: string }[]; nextPageToken?: string }
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
const messageSchema = z.strictObject({
  id: z.string(), threadId: z.string(), labels: z.string().array(), subject: z.string(),
  from: z.string(), to: z.string(), snippet: z.string(), date: z.string(),
})
const pageSchema = z.strictObject({
  accountId: z.string(), key: z.string(), savedAt: z.number().nonnegative(),
  messages: z.array(z.strictObject({ message: messageSchema, draftId: z.string().optional() })).max(MAIL_PAGE_SIZE),
  nextPageToken: z.string().optional(),
})
const cacheSchema = z.strictObject({ version: z.literal(1), pages: pageSchema.array().max(20) })
// Persist only list headers/previews, never message bodies, draft text, tokens or attachment bytes.
export function createMailCache(storage: () => Storage = () => localStorage, now = Date.now) {
  let unavailable = false
  function read() {
    if (unavailable) return []
    try {
      const raw = storage().getItem(mailCacheKey)
      if (!raw || raw.length > 250_000) return []
      const result = cacheSchema.safeParse(JSON.parse(raw))
      return result.success ? result.data.pages.filter(page => page.savedAt <= now() && now() - page.savedAt < MAIL_CACHE_TTL) : []
    } catch { return [] } // Caching must not make Gmail unusable when device storage is blocked.
  }
  const keyFor = (folder: MailFolder, query: string, token: string) => JSON.stringify([folder, query, token, MAIL_PAGE_SIZE])
  return {
    get(accountId: string, folder: MailFolder, query: string, token: string): MailListPage | undefined {
      const page = read().find(page => page.accountId === accountId && page.key === keyFor(folder, query, token))
      if (!page) return
      return { messages: page.messages.map(row => ({ ...row, message: { ...row.message, cc: '', bcc: '', replyTo: '', messageId: '', references: '', text: '', html: '', attachments: [] } })), nextPageToken: page.nextPageToken }
    },
    set(accountId: string, folder: MailFolder, query: string, token: string, result: MailListPage) {
      const key = keyFor(folder, query, token)
      const page = { accountId, key, savedAt: now(), nextPageToken: result.nextPageToken, messages: result.messages.slice(0, MAIL_PAGE_SIZE).map(({ message, draftId }) => ({ draftId, message: { id: message.id, threadId: message.threadId, labels: message.labels, subject: message.subject, from: message.from, to: message.to, snippet: message.snippet, date: message.date } })) }
      const parsed = pageSchema.safeParse(page)
      if (!parsed.success) return
      const pages = [parsed.data, ...read().filter(page => page.accountId !== accountId || page.key !== key)].slice(0, 20)
      try {
        let raw = JSON.stringify({ version: 1, pages })
        while (raw.length > 250_000 && pages.length) { pages.pop(); raw = JSON.stringify({ version: 1, pages }) }
        storage().setItem(mailCacheKey, raw)
        unavailable = false
      } catch { /* Reads still work from Gmail if quota/storage prevents caching. */ }
    },
    clear() { unavailable = true; try { storage().removeItem(mailCacheKey); unavailable = false } catch { /* Unavailable storage is never used by reads. */ } },
  }
}
