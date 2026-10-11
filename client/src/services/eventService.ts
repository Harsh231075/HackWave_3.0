import { createCollection } from './local/collection.ts'
import { meetingSchema } from '../domain/adaptiveData.ts'
import { projectNoteSchema } from '../domain/projects.ts'
import { projectSettings, validProject } from './projectOwnership.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { prepareEvent, type EventInput, type ActionResult } from '../domain/commands.ts'
import type { Event } from '../domain/types.ts'
export interface EventFilters { from?: string; to?: string; category?: Event['category'] }
export function createEventService(database: BrowserDatabase, createId: () => string = () => crypto.randomUUID()) {
  const meetings = createCollection(database, 'meetings', meetingSchema)
  const notes = createCollection(database, 'notes', projectNoteSchema)
  const commit = (record: Event): ActionResult<Event> => database.transaction(() => {
    if (projectSettings(database) && record.category === 'meeting') {
      const prior = meetings.list().find(meeting => meeting.eventId === record.id)
      const memberships = database.readCollection('projectClients')
      if (record.clientId && (memberships.status !== 'found' || !Array.isArray(memberships.value) || !memberships.value.some(link => link.projectId === record.projectId && link.clientId === record.clientId && (link.active || prior?.clientId === record.clientId)))) return { ok: false, message: 'Choose a client attached to this project.' }
      if (prior && prior.projectId !== record.projectId) return { ok: false, message: 'This meeting belongs to its original project.' }
      const id = prior?.id ?? record.id
      const saved = meetings.save({ id, eventId: record.id, projectId: record.projectId!, clientId: record.clientId, title: record.title, date: record.date, start: record.start, end: record.end, participants: record.participants, agenda: '' })
      if (!saved.ok) return saved
      const draftKey = `meeting-agenda:${id}`
      if (!notes.list().some(note => note.draftKey === draftKey)) {
        const note = notes.create({ projectId: record.projectId!, meetingId: id, title: record.title, kind: 'agenda', draftKey })
        if (!note.ok) return note
      }
      database.dispatch({ type: 'draft', key: draftKey, value: record.agenda })
      database.dispatch({ type: 'event', event: { ...record, agenda: '' } })
    } else database.dispatch({ type: 'event', event: record })
    return { ok: true, value: structuredClone(record) }
  })
  const getById = (id: string) => (() => { const event = database.getState().events.find(event => event.id === id); if (!event) return null; const meeting = projectSettings(database) ? meetings.list().find(meeting => meeting.eventId === id) : null; return structuredClone({ ...event, ...(meeting ? { agenda: database.getState().drafts[`meeting-agenda:${meeting.id}`] ?? '' } : {}) }) })()
  const save = (input: EventInput): ActionResult<Event> => {
    if (!validProject(database, input.projectId)) return { ok: false, message: 'Choose an available project.' }
    const result = prepareEvent(input, database.getState(), createId)
    if (!result.ok) return result
    return commit(result.value.record)
  }
  return {
    getById, save,
    createWithId(id: string, input: Omit<Event, 'id'>): ActionResult<Event> {
      if (getById(id)) return { ok: false, message: 'This event already exists.' }
      if (!validProject(database, input.projectId)) return { ok: false, message: 'Choose an available project.' }
    const result = prepareEvent(input, database.getState(), () => id)
      if (!result.ok) return result
      return commit(result.value.record)
    },
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
