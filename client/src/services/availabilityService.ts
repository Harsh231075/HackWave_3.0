import type { BrowserDatabase } from './browserDatabase.ts'
import { eventError, minutes } from '../domain/workspace.ts'
export function createAvailabilityService(database: BrowserDatabase) {
  const isAvailable = ({ date, start, end }: { date: string; start: string; end: string }) => !eventError({ id: 'slot-preview', title: 'Slot', date, start, end, category: 'meeting', participants: [], agenda: '' }, database.getState().events)
  return {
    isAvailable,
    findSlots({ date, duration = 60, from = '09:00', to = '18:00', step = 30 }: { date: string; duration?: number; from?: string; to?: string; step?: number }) {
      if (![duration, step].every(value => Number.isInteger(value) && value > 0)) return []
      const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
      const slots: Array<{ date: string; start: string; end: string }> = []
      for (let time = minutes(from); time + duration <= Math.min(minutes(to), 1439); time += step) {
        const slot = { date, start: format(time), end: format(time + duration) }
        if (isAvailable(slot)) slots.push(slot)
      }
      return slots
    },
  }
}
