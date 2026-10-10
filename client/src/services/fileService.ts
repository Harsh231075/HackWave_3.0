import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
const schema = z.object({ id: z.string().min(1), name: z.string().min(1).max(255), mimeType: z.string(), size: z.number().min(0).max(2 * 1024 * 1024), content: z.string() })
export function createFileService(database: BrowserDatabase) {
  const files = createCollection(database, 'files', schema)
  return {
    list: () => files.list().map(({ content: _content, ...metadata }) => metadata),
    async upload(file: Blob, name: string) {
      if (file.size > 2 * 1024 * 1024) return { ok: false as const, message: 'Local attachments must be smaller than 2 MB.' }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return files.create({ name, mimeType: file.type, size: file.size, content: btoa(binary) })
      } catch { return { ok: false as const, message: 'Unable to read this attachment.' } }
    },
    getDownloadUrl(id: string) {
      const file = files.getById(id)
      if (!file) return null
      try { const bytes = Uint8Array.from(atob(file.content), character => character.charCodeAt(0)); return URL.createObjectURL(new Blob([bytes], { type: file.mimeType })) } catch { return null }
    },
    revokeDownloadUrl: (url: string) => URL.revokeObjectURL(url),
    delete: files.delete,
  }
}
