import type { BrowserDatabase } from './browserDatabase.ts'
import { prepareEvent, type EventInput, type ActionResult } from '../domain/commands.ts'
import type { Event } from '../domain/types.ts'
export interface EventFilters { from?: string; to?: string; category?: Event['category'] }
export function createEventService(database: BrowserDatabase, createId: () => string = () => crypto.randomUUID()) {
  const getById = (id: string) => structuredClone(database.getState().events.find(event => event.id === id) ?? null)
  const save = (input: EventInput): ActionResult<Event> => {
    const result = prepareEvent(input, database.getState(), createId)
    if (!result.ok) return result
    database.dispatch(result.value.action)
    return { ok: true, value: structuredClone(result.value.record) }
  }
  return {
    getById, save,
    list: ({ from, to, category }: EventFilters = {}) => structuredClone(database.getState().events.filter(event => (!from || event.date >= from) && (!to || event.date <= to) && (!category || event.category === category)).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))),
    create: (input: Omit<Event, 'id'>) => save(input),
    update(id: string, patch: Partial<Omit<Event, 'id'>>) { const event = getById(id); return event ? save({ ...event, ...patch, id }) : { ok: false as const, message: 'This event is no longer available.' } },
    delete(id: string): ActionResult<void> {
      if (!getById(id)) return { ok: false, message: 'This event is no longer available.' }
      database.dispatch({ type: 'delete-event', id })
      return { ok: true, value: undefined }
    },
  }
}
