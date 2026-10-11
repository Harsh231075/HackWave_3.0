import { z } from 'zod'

export const calendarEventSchema = z.object({
  id: z.string().min(1), calendarId: z.string(), title: z.string(), description: z.string(),
  start: z.string(), end: z.string(), allDay: z.boolean(), timezone: z.string(),
  attendees: z.array(z.object({ email: z.string(), name: z.string().optional(), response: z.string().optional() })),
  organizer: z.string(), location: z.string(), meetingUrl: z.string(), url: z.string(),
  revision: z.string(), status: z.string(), transparent: z.boolean().optional(),
})
export type CalendarEvent = z.infer<typeof calendarEventSchema>
export type CalendarConnection = { connected: boolean; configured: boolean; accountId?: string; email?: string; canWrite?: boolean; timezone?: string }
export const eventDraftSchema = z.strictObject({
  title: z.string().trim().min(1).max(200), description: z.string().max(5000),
  start: z.iso.datetime({ offset: true }), end: z.iso.datetime({ offset: true }),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false } }, 'Invalid timezone'),
  attendees: z.array(z.email()).max(30),
}).refine(value => Date.parse(value.end) > Date.parse(value.start) && Date.parse(value.end) - Date.parse(value.start) <= 86400000, 'Choose an end after the start, within one day.')
export type EventDraft = z.infer<typeof eventDraftSchema>

export function calendarDate(now = new Date(), timezone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function shiftDate(date: string, days: number) {
  const value = new Date(date + 'T12:00:00Z')
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
// Resolve local wall time against an IANA zone instead of the server's timezone.
export function zonedInstant(date: string, time: string, timezone: string) {
  const target = Date.parse(`${date}T${time}:00Z`)
  if (!Number.isFinite(target)) throw new Error('Choose a valid date and time.')
  let instant = target
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
  const wall = (value: number) => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(value)).map(p => [p.type, p.value]))
    return Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)
  }
  for (let i = 0; i < 3; i++) instant += target - wall(instant)
  if (wall(instant) !== target) throw new Error('This local time does not exist because the clock changes. Choose another time.')
  return new Date(instant).toISOString()
}
export function calendarWindow(date: string, timezone: string) {
  return { from: zonedInstant(date, '00:00', timezone), to: zonedInstant(shiftDate(date, 1), '00:00', timezone) }
}
export function displayEventTime(event: CalendarEvent, timezone: string) {
  if (event.allDay) return `${event.start} · All day`
  const options: Intl.DateTimeFormatOptions = { timeZone: timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return `${new Date(event.start).toLocaleString('en-IN', options)} – ${new Date(event.end).toLocaleString('en-IN', options)} · ${timezone}`
}

export const eventEditSchema=z.union([eventDraftSchema,z.strictObject({allDay:z.literal(true),title:z.string().trim().min(1).max(200),description:z.string().max(5000),start:z.iso.date(),end:z.iso.date(),timezone:z.string().refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}}),attendees:z.array(z.email()).max(30)}).refine(d=>d.end>d.start&&Date.parse(d.end)-Date.parse(d.start)<=31*86400000,'Choose an exclusive end date after the start, within 31 days.')])
export type EventEditDraft=z.infer<typeof eventEditSchema>
