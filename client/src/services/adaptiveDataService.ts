import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import { createCollection } from './local/collection.ts'
import { clientSchema, adaptiveProjectSchema, meetingSchema, communicationSchema, issueSchema, relationshipSchema, adaptiveResourceSchema, preparationSchema, type Meeting, type Preparation } from '../domain/adaptiveData.ts'
import { intentCandidatesSchema, type IntentCandidates } from '../domain/intent.ts'

const schemas = { clients: clientSchema, projects: adaptiveProjectSchema, meetings: meetingSchema, communications: communicationSchema, issues: issueSchema, relationships: relationshipSchema, resources: adaptiveResourceSchema }
function read<T>(database: BrowserDatabase, key: string, schema: z.ZodType<T>): LoadResult<T[]> {
  const loaded = database.readCollection(key)
  if (loaded.status === 'missing') return { status: 'found', value: [] }
  if (loaded.status !== 'found') return loaded
  const parsed = schema.array().safeParse(loaded.value)
  if (!parsed.success || new Set(parsed.data.map(item => (item as { id: string }).id)).size !== parsed.data.length) return { status: 'invalid' }
  return { status: 'found', value: parsed.data }
}
export function createAdaptiveDataService(database: BrowserDatabase) {
  function snapshot() {
    const clients = read(database, 'clients', schemas.clients), projects = read(database, 'projects', schemas.projects), meetings = read(database, 'meetings', schemas.meetings)
    const communications = read(database, 'communications', schemas.communications), issues = read(database, 'issues', schemas.issues), relationships = read(database, 'relationships', schemas.relationships), resources = read(database, 'resources', schemas.resources)
    if ([clients, projects, meetings, communications, issues, relationships, resources].some(result => result.status !== 'found')) return null
    if (clients.status !== 'found' || projects.status !== 'found' || meetings.status !== 'found' || communications.status !== 'found' || issues.status !== 'found' || relationships.status !== 'found' || resources.status !== 'found') return null
    const state = database.getState()
    const validProjects = projects.value.filter(project => !project.clientId || clients.value.some(client => client.id === project.clientId))
    const effectiveMeetings = meetings.value.flatMap(meeting => {
      if (!clients.value.some(client => client.id === meeting.clientId) || !validProjects.some(project => project.id === meeting.projectId && project.clientId === meeting.clientId)) return []
      if (!meeting.eventId) return [meeting]
      const event = state.events.find(item => item.id === meeting.eventId && item.category === 'meeting')
      if (!event) return []
      const parsed = meetingSchema.safeParse({ ...meeting, date: event.date, start: event.start, end: event.end, participants: event.participants, agenda: event.agenda, title: event.title })
      return parsed.success ? [parsed.data] : []
    })
    return { clients: clients.value, projects: validProjects, meetings: effectiveMeetings, communications: communications.value, issues: issues.value, relationships: relationships.value, resources: resources.value, tasks: state.tasks }
  }
  const hasScope = (clientId: string, projectId: string, meetingId?: string) => {
    const data = snapshot()
    return !!data && data.projects.some(project => project.id === projectId && project.clientId === clientId) && (!meetingId || data.meetings.some(meeting => meeting.id === meetingId && meeting.clientId === clientId && meeting.projectId === projectId))
  }
  function scopedCollection<T extends { id: string }>(key: string, schema: z.ZodType<T>, valid: (record: T) => boolean) {
    const base = createCollection(database, key, schema)
    const save = (record: T) => {
      const parsed = schema.safeParse(record)
      if (!parsed.success || !valid(parsed.data)) return { ok: false as const, message: `Invalid ${key} references or ownership.` }
      return base.save(parsed.data)
    }
    return { ...base, save,
      create: (input: Omit<T, 'id'>) => save({ ...input, id: crypto.randomUUID() } as T),
      update: (id: string, patch: Partial<Omit<T, 'id'>>) => { const record = base.getById(id); return record ? save({ ...record, ...patch, id }) : { ok: false as const, message: `This ${key} record is no longer available.` } },
    }
  }
  const clients = createCollection(database, 'clients', clientSchema)
  const projects = scopedCollection('projects', adaptiveProjectSchema, record => !record.clientId || clients.getById(record.clientId) !== null)
  const meetings = scopedCollection('meetings', meetingSchema, record => hasScope(record.clientId, record.projectId) && (!record.eventId || database.getState().events.some(event => event.id === record.eventId && event.category === 'meeting')))
  const communications = scopedCollection('communications', communicationSchema, record => hasScope(record.clientId, record.projectId, record.meetingId))
  const issues = scopedCollection('issues', issueSchema, record => hasScope(record.clientId, record.projectId, record.meetingId))
  const relationships = scopedCollection('relationships', relationshipSchema, link => {
    const data = snapshot()
    if (!data) return false
    const source = link.sourceKind === 'meeting' ? data.meetings.find(item => item.id === link.sourceId) : data.projects.find(item => item.id === link.sourceId)
    if (!source) return false
    if (link.targetKind === 'task' || link.targetKind === 'resource') {
      const records = link.targetKind === 'task' ? data.tasks : data.resources
      const projectId = link.sourceKind === 'project' ? source.id : (source as Meeting).projectId
      const crossProject = data.relationships.some(item => item.id !== link.id && item.sourceKind === 'project' && item.sourceId !== projectId && item.targetKind === link.targetKind && item.targetId === link.targetId)
      return !crossProject && records.some(item => item.id === link.targetId)
    }
    const target = data.meetings.find(item => item.id === link.targetId)
    const sourceMeeting = source as Meeting
    return !!target && target.id !== sourceMeeting.id && target.clientId === sourceMeeting.clientId && target.projectId === sourceMeeting.projectId && target.date < sourceMeeting.date
  })
  return {
    snapshot, clients, projects, meetings, communications, issues, relationships,
    loadCandidates(): LoadResult<IntentCandidates> {
      const data = snapshot()
      if (!data) return { status: 'invalid' }
      const catalog = intentCandidatesSchema.safeParse({
        clients: data.clients.map(client => ({ id: client.id, label: client.name })),
        projects: data.projects.map(project => ({ id: project.id, label: project.name, ...(project.clientId ? { clientId: project.clientId } : {}) })),
        meetings: data.meetings.map(meeting => ({ id: meeting.id, label: `${data.clients.find(client => client.id === meeting.clientId)?.name} · ${meeting.title} · ${meeting.date} ${meeting.start}–${meeting.end}`, date: meeting.date, clientId: meeting.clientId, projectId: meeting.projectId })),
      })
      return catalog.success ? { status: 'found', value: catalog.data } : { status: 'invalid' }
    },
    loadPreparation(meetingId: string): LoadResult<Preparation> {
      const data = snapshot()
      if (!data) return { status: 'invalid' }
      const meeting = data.meetings.find(item => item.id === meetingId)
      if (!meeting) return { status: 'missing' }
      const client = data.clients.find(item => item.id === meeting.clientId), project = data.projects.find(item => item.id === meeting.projectId)
      if (!client || !project) return { status: 'missing' }
      const links = data.relationships.filter(link => (link.sourceKind === 'meeting' && link.sourceId === meeting.id) || (link.sourceKind === 'project' && link.sourceId === meeting.projectId))
      const selected = (kind: string, id: string) => links.some(link => link.type === 'related' && link.targetKind === kind && link.targetId === id)
      // Links cannot import a record explicitly assigned to another project.
      const exclusive = (kind: string, id: string) => !data.relationships.some(link => link.sourceKind === 'project' && link.sourceId !== project.id && link.targetKind === kind && link.targetId === id)
      const previousMeeting = data.meetings.filter(item => item.clientId === client.id && item.projectId === project.id && item.date < meeting.date && links.some(link => link.type === 'previous_meeting' && link.targetId === item.id)).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
      const scoped = (item: { clientId: string; projectId: string; meetingId?: string }) => item.clientId === client.id && item.projectId === project.id && (!item.meetingId || item.meetingId === meeting.id)
      const result = preparationSchema.safeParse({ meeting, client, project, previousMeeting,
        tasks: data.tasks.filter(task => selected('task', task.id) && exclusive('task', task.id)).slice(0, 100),
        resources: data.resources.filter(resource => selected('resource', resource.id) && exclusive('resource', resource.id)).slice(0, 100),
        communications: data.communications.filter(item => scoped(item) && item.date <= meeting.date).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
        issues: data.issues.filter(item => scoped(item) && item.status === 'open').slice(0, 100),
        reasons: { tasks: `Tasks explicitly linked to ${project.name} or this meeting.`, resources: 'Sources explicitly linked to this project or meeting.', communications: 'Latest communications in the selected project through the meeting date.', issues: 'Open issues belonging to the selected client and project.' },
      })
      return result.success ? { status: 'found', value: result.data } : { status: 'invalid' }
    },
  }
}
