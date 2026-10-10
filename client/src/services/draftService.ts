import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
export function createDraftService(database: BrowserDatabase) {
  return {
    get: (key: string) => database.getState().drafts[key] ?? null,
    save(key: string, value: string): ActionResult<void> {
      if (!key || value.length > 5000) return { ok: false, message: 'Keep your draft under 5000 characters.' }
      database.dispatch({ type: 'draft', key, value }); return { ok: true, value: undefined }
    },
    delete(key: string): ActionResult<void> {
      if (!Object.hasOwn(database.getState().drafts, key)) return { ok: false, message: 'This draft is no longer available.' }
      database.dispatch({ type: 'delete-draft', key }); return { ok: true, value: undefined }
    },
  }
}
