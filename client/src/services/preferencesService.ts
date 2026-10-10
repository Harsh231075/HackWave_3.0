import type { DisplayPreferences, PreferencesService, StorageAdapter } from './contracts.ts'
const entries = {
  taskView: { key: 'task-view', fallback: 'list', allowed: ['list', 'kanban'] },
  calendarView: { key: 'calendar-view', fallback: 'month', allowed: ['month', 'week', 'day', 'agenda'] },
  calendarCategory: { key: 'calendar-category', fallback: 'all', allowed: ['all', 'meeting', 'focus', 'class', 'break'] },
}
export function createPreferencesService(storage: StorageAdapter): PreferencesService {
  return {
    load() {
      return Object.fromEntries(Object.entries(entries).map(([name, { key, fallback, allowed }]) => {
        const result = storage.readString(key)
        return [name, result.status === 'found' && allowed.includes(result.value) ? result.value : fallback]
      })) as unknown as DisplayPreferences
    },
    save(patch) {
      const values = Object.entries(patch)
      if (values.some(([name, value]) => !Object.hasOwn(entries, name) || !entries[name as keyof DisplayPreferences].allowed.includes(value))) return { status: 'invalid' }
      let unavailable = false
      for (const [name, value] of values) {
        if (storage.writeString(entries[name as keyof DisplayPreferences].key, value).status !== 'saved') unavailable = true
      }
      return { status: unavailable ? 'unavailable' : 'saved' }
    },
  }
}
