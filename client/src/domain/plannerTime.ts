import { zonedInstant, shiftDate, type CalendarEvent } from './calendar.ts'
import type { Event } from './types.ts'
export type TimeInterval = { start: number; end: number }
export function googleBusyIntervals(events: CalendarEvent[], timezone: string): TimeInterval[] {
  return events.filter(e => e.status !== 'cancelled' && !e.transparent).map(e => ({ start: Date.parse(e.allDay ? zonedInstant(e.start,'00:00',timezone) : e.start), end: Date.parse(e.allDay ? zonedInstant(e.end,'00:00',timezone) : e.end) }))
}
export function localBusyIntervals(events: Event[], timezone: string): TimeInterval[] {
  return events.map(e => ({start:Date.parse(zonedInstant(e.date,e.start,timezone)),end:Date.parse(zonedInstant(e.date,e.end,timezone))}))
}
export function overlaps(intervals: TimeInterval[], start: number, end: number) { return intervals.some(i => i.start < end && i.end > start) }
export function occupiedMinutes(intervals: TimeInterval[], from: number, to: number) {
  const spans = intervals.map(i => ({start:Math.max(from,i.start),end:Math.min(to,i.end)})).filter(i => i.end > i.start).sort((a,b)=>a.start-b.start)
  let end=from, occupied=0
  for(const span of spans){occupied+=Math.max(0,span.end-Math.max(end,span.start));end=Math.max(end,span.end)}
  return occupied/60000
}
export function plannerSummary(local: Event[], google: CalendarEvent[], date: string, timezone: string) {
  const from=Date.parse(zonedInstant(date,'09:00',timezone)),to=Date.parse(zonedInstant(date,'18:00',timezone))
  const meetings = [...localBusyIntervals(local.filter(e=>e.category==='meeting'||e.category==='class'),timezone),...googleBusyIntervals(google,timezone)]
  const focus=localBusyIntervals(local.filter(e=>e.category==='focus'),timezone)
  const busy=occupiedMinutes([...localBusyIntervals(local,timezone),...googleBusyIntervals(google,timezone)],from,to)
  return {meetingMinutes:occupiedMinutes(meetings,from,to),focusMinutes:occupiedMinutes(focus,from,to),freeMinutes:(to-from)/60000-busy}
}
export function slotConflicts(events: CalendarEvent[], date: string, start: string, end: string, timezone: string) {
  return overlaps(googleBusyIntervals(events,timezone),Date.parse(zonedInstant(date,start,timezone)),Date.parse(zonedInstant(date,end,timezone)))
}
export function dayBounds(date:string,timezone:string){return {from:zonedInstant(date,'00:00',timezone),to:zonedInstant(shiftDate(date,1),'00:00',timezone)}}
