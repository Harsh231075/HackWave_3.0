import { persistedSchema } from './workspaceService.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createEventService } from './eventService.ts'
import { createAvailabilityService } from './availabilityService.ts'
import { loadActionScope } from './actionScope.ts'
import { intentDateSchema, type ResolvedIntent } from '../domain/intent.ts'
import type { WidgetBinding } from '../domain/widgetInstances.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
import type { Event } from '../domain/types.ts'
import { minutes } from '../domain/workspace.ts'
const timeLabel = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
type SchedulingInput = { taskId: string; date: string } & ({ intent: ResolvedIntent; binding?: never } | { binding: WidgetBinding; intent?: never })
export function createFocusSchedulingService(database: BrowserDatabase, referenceDate: () => string) {
  const adaptive = createAdaptiveDataService(database), events = createEventService(database)
  function taskFor(input: SchedulingInput) {
    const binding: WidgetBinding = input.binding ?? { kind: 'overdue', intent: input.intent!, referenceDate: referenceDate() }
    const minimum = binding.kind === 'overdue' ? binding.referenceDate : referenceDate()
    if (!intentDateSchema.safeParse(input.date).success || input.date < minimum) return null
    return loadActionScope(database, binding)?.tasks.find(t => t.id === input.taskId && t.status === 'pending' && Number.isInteger(t.duration) && t.duration >= 5 && t.duration <= 480) ?? null
  }
  function busy() {
    const saved = database.storage.readJson('gogpt-workspace-v1')
    if (saved.status === 'invalid' || (saved.status === 'found' && !persistedSchema.safeParse(saved.value).success)) return null
    const data = adaptive.snapshot()
    if (!data) return null
    return data.meetings.filter(m => !m.eventId).map(m => ({ ...m, category: 'meeting' as const }))
  }
  function findSlots(input: SchedulingInput): ActionResult<Array<{ date: string; start: string; end: string }>> {
    const task = taskFor(input), extra = busy()
    if (!task || !extra) return { ok: false, message: 'Scheduling is unavailable. Check task status, scope, date and saved calendar records.' }
    return { ok: true, value: createAvailabilityService(database, () => extra).findSlots({ date: input.date, duration: task.duration }) }
  }
  return { findSlots, schedule(input: SchedulingInput & { start: string; expectedDuration: number }): ActionResult<Event> {
    const task = taskFor(input)
    if (!task || task.duration !== input.expectedDuration) return { ok: false, message: 'Task changed. Choose an available slot again.' }
    const id = `recommendation-${task.id}`
    const existing = events.getById(id)
    if (existing) {
      const same = existing.date === input.date && existing.start === input.start && existing.end === timeLabel(minutes(input.start) + task.duration) && existing.category === 'focus' && existing.title === `Focus: ${task.title}` && existing.agenda === task.description && JSON.stringify(existing.participants) === JSON.stringify([task.owner])
      const extra = busy()
      const conflicts = extra && createAvailabilityService(database, () => extra)
      // Ignore only this matching event when checking a repeated confirmation.
      const other = database.getState().events.filter(e => e.id !== id).concat(extra ?? [])
      const overlapping = other.some(e => e.date === existing.date && minutes(e.start) < minutes(existing.end) && minutes(e.end) > minutes(existing.start))
      return same && conflicts && !overlapping ? { ok: true, value: existing } : { ok: false, message: 'This task already has a different focus session, or its slot is now occupied. Review it in Calendar.' }
    }
    const slots = findSlots(input)
    const slot = slots.ok ? slots.value.find(s => s.start === input.start) : undefined
    if (!slot) return { ok: false, message: 'This slot is no longer available. Choose another time.' }
    return events.createWithId(id, {  title: `Focus: ${task.title}`, ...slot, category: 'focus', participants: [task.owner], agenda: task.description })
  } }
}
