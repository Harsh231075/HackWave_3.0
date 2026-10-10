import { persistedSchema } from './workspaceService.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createOverdueReviewService } from './overdueReviewService.ts'
import { createEventService } from './eventService.ts'
import { createAvailabilityService } from './availabilityService.ts'
import { intentDateSchema, type ResolvedIntent } from '../domain/intent.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
import type { Event } from '../domain/types.ts'
import { minutes } from '../domain/workspace.ts'
export function createFocusSchedulingService(database: BrowserDatabase, referenceDate: () => string) {
  const adaptive = createAdaptiveDataService(database), reviews = createOverdueReviewService(database), events = createEventService(database)
  function taskFor(input: { taskId: string; date: string; intent: ResolvedIntent }) {
    if (!intentDateSchema.safeParse(input.date).success || input.date < referenceDate()) return null
    const review = reviews.load(input.intent, referenceDate())
    return review.status === 'found' ? review.value.tasks.find(t => t.id === input.taskId && t.status === 'pending' && Number.isInteger(t.duration)) ?? null : null
  }
  function busy() {
    const saved = database.storage.readJson('gogpt-workspace-v1')
    if (saved.status === 'invalid' || (saved.status === 'found' && !persistedSchema.safeParse(saved.value).success)) return null
    const data = adaptive.snapshot()
    if (!data) return null
    // Linked meetings are already represented by their current calendar event.
    return data.meetings.filter(m => !m.eventId).map(m => ({ ...m, category: 'meeting' as const }))
  }
  function findSlots(input: { taskId: string; date: string; intent: ResolvedIntent }): ActionResult<Array<{ date: string; start: string; end: string }>> {
    const task = taskFor(input), extra = busy()
    if (!task || !extra) return { ok: false, message: 'Scheduling is unavailable. Check task status, scope, date and saved calendar records.' }
    const availability = createAvailabilityService(database, () => extra)
    return { ok: true, value: availability.findSlots({ date: input.date, duration: task.duration }) }
  }
  return { findSlots, schedule(input: { taskId: string; date: string; start: string; intent: ResolvedIntent; expectedDuration: number }): ActionResult<Event> {
    const task = taskFor(input)
    if (!task || task.duration !== input.expectedDuration) return { ok: false, message: 'Task changed. Choose an available slot again.' }
    const id = `recommendation-${task.id}`
    const existing = events.getById(id)
    if (existing) return { ok: true, value: existing }
    const slots = findSlots(input)
    const slot = slots.ok ? slots.value.find(s => s.start === input.start) : undefined
    if (!slot) return { ok: false, message: 'This slot is no longer available. Choose another time.' }
    if (minutes(slot.end) - minutes(slot.start) !== task.duration) return { ok: false, message: 'Task duration changed.' }
    return events.createWithId(id, { title: `Focus: ${task.title}`, ...slot, category: 'focus', participants: [task.owner], agenda: task.description })
  } }
}
