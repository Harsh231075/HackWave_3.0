import { calendarDate, shiftDate, zonedInstant, type CalendarEvent } from './calendar.ts'
import type { Event } from './types.ts'
export type DisplayCalendarEvent = Event & { allDay?: boolean }
// Display-only projections retain provider IDs; never send these through local record editors.
export function projectGoogleEvents(events: CalendarEvent[], from: string, to: string, timezone: string): DisplayCalendarEvent[] {
  const result: DisplayCalendarEvent[] = []
  const wall = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value))
  for (const event of events) {
    if (event.status === 'cancelled') continue
    for (let date = from; date <= to; date = shiftDate(date, 1)) {
      const fromInstant = zonedInstant(date, '00:00', timezone), toInstant = zonedInstant(shiftDate(date, 1), '00:00', timezone)
      const spans = event.allDay ? event.start <= date && event.end > date : Date.parse(event.start) < Date.parse(toInstant) && Date.parse(event.end) > Date.parse(fromInstant)
      if (!spans) continue
      result.push({ id: `google:${event.id}:${date}`, title: `Google · ${event.title}`, date, start: event.allDay || Date.parse(event.start) <= Date.parse(fromInstant) ? '00:00' : wall(event.start), end: event.allDay || Date.parse(event.end) >= Date.parse(toInstant) ? '23:59' : wall(event.end), allDay: event.allDay, category: 'meeting', participants: event.attendees.map(a => a.name ?? a.email), agenda: event.description })
    }
  }
  return result
}
export function isUpcoming(event: CalendarEvent, now: number, timezone: string) {
  return event.status !== 'cancelled' && (event.allDay ? event.end > calendarDate(new Date(now), timezone) : Date.parse(event.end) > now)
}
