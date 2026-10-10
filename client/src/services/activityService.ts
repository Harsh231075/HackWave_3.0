import type { BrowserDatabase } from './browserDatabase.ts'
export function createActivityService(database: BrowserDatabase) {
  return { list: ({ limit = 12 }: { limit?: number } = {}) => database.getState().activity.slice(0, Math.max(0, Math.floor(limit))) }
}
