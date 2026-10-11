import { z } from 'zod'
import { calendarEventSchema, type CalendarConnection, type EventDraft } from '../domain/calendar.ts'
import { createHttpClient } from './api/httpClient.ts'
const connectionSchema = z.object({ connected: z.boolean(), configured: z.boolean(), accountId: z.string().optional(), email: z.string().optional(), canWrite: z.boolean().optional() })
const eventListSchema = z.object({ accountId: z.string(), events: calendarEventSchema.array(), refreshedAt: z.string() })
const operationSchema = z.object({ id: z.string(), state: z.enum(['draft', 'pending', 'created']), event: calendarEventSchema.optional() })
export function createGoogleCalendarService() {
  const request = (path: string, body?: unknown, signal?: AbortSignal) => createHttpClient().requestJson('/api/calendar/' + path, {
    ...(body !== undefined ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Orlo-Request': '1' }, body: JSON.stringify(body) } : {}), signal, credentials: 'same-origin',
  })
  return {
    async status(signal?: AbortSignal): Promise<CalendarConnection> { return connectionSchema.parse(await request('connections', undefined, signal)) },
    authorize(write = false) {
      const browser = globalThis as typeof globalThis & { location?: { assign: (url: string) => void } }
      if (!browser.location) throw new Error('Open Orlo in your browser to connect Google Calendar.')
      browser.location.assign('/api/calendar/google/connect' + (write ? '?access=write' : ''))
    },
    async disconnect() { await request('google/disconnect', {}) },
    async events(from: string, to: string, timezone: string, signal?: AbortSignal) {
      return eventListSchema.parse(await request('events?' + new URLSearchParams({ from, to, timezone }), undefined, signal))
    },
    async event(id: string, signal?: AbortSignal) {
      return z.object({ accountId: z.string(), event: calendarEventSchema }).parse(await request('events/' + encodeURIComponent(id), undefined, signal))
    },
    async prepare(eventId: string, goal: string, signal?: AbortSignal) {
      return z.object({ accountId: z.string(), event: calendarEventSchema, widgets: z.array(z.enum(['details', 'outline', 'calendar'])), rationale: z.string(), source: z.enum(['ai', 'local']) }).parse(await request('preparation', { eventId, goal }, signal))
    },
    async availability(date: string, duration: number, timezone: string, signal?: AbortSignal) {
      return z.object({ slots: z.array(z.object({ start: z.string(), end: z.string() })), notice: z.string() }).parse(await request('availability', { date, duration, timezone }, signal))
    },
    async preview(draft: EventDraft) { return z.object({ id: z.string() }).parse(await request('event-drafts', draft)) },
    async confirm(id: string) { return operationSchema.parse(await request('event-drafts/' + encodeURIComponent(id) + '/confirm', {})) },
    async operation(id: string) { return operationSchema.parse(await request('operations/' + encodeURIComponent(id))) },
  }
}
export const googleCalendarService = createGoogleCalendarService()
