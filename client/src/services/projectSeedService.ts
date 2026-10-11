import { makeInstance } from '../domain/widgetInstances.ts'
import { PRESETS } from '../lib/workspace/config.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { freshProjectData, emptyRecords } from './projectDataService.ts'
import { calendarDate, shiftDate } from '../domain/calendar.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageDataService } from './usageDataService.ts'
import { createBrowserDatabase } from './browserDatabase.ts'
import type { StorageAdapter } from './contracts.ts'
export function createProjectSeedService(database: BrowserDatabase, today = () => calendarDate(), uuid = () => crypto.randomUUID()) {
  return { seed() {
    const state = database.getState()
    const occupied = ['clients', 'meetings', 'resources', 'issues', 'communications', 'usageObservations', 'usageReleases', 'files'].some(key => {
      const loaded = database.readCollection(key)
      return loaded.status === 'invalid' || loaded.status === 'found' && Array.isArray(loaded.value) && loaded.value.length > 0
    })
    const notes = database.readCollection('notes'), links = database.readCollection('projectClients')
    if(notes.status === 'invalid' || notes.status === 'found' && Array.isArray(notes.value) && notes.value.length > 1 || links.status === 'found' && Array.isArray(links.value) && links.value.length) return {ok:false as const,message:'Reset local data before adding sample data.'}
    const existingProjects = database.readCollection('projects')
    if (occupied || state.tasks.length || state.events.length || Object.values(state.drafts).some(Boolean) || existingProjects.status !== 'found' || !Array.isArray(existingProjects.value) || existingProjects.value.length !== 1) return { ok: false as const, message: 'Reset local data before adding sample data.' }
    const data = freshProjectData(), snapshot = emptyRecords(), date = today()
    // Preserve the existing empty Default project, including its editable name.
    data.projects[0] = existingProjects.value[0]
    data.projectSettings.defaultProjectId = data.projects[0].id
    data.notes = [{ id: uuid(), projectId: data.projects[0].id, title: 'Project notes', kind: 'general', draftKey: `project-outline:${data.projects[0].id}` }]
    const collections: Record<string, unknown> = data
    const clients: unknown[] = [], projectClients: unknown[] = [], meetings: unknown[] = [], communications: unknown[] = [], issues: unknown[] = [], resources: unknown[] = [], observations: unknown[] = [], releases: unknown[] = [], relationships: unknown[] = []
    for (const [index, name] of ['Website launch', 'Mobile onboarding'].entries()) {
      const projectId = uuid(), clientId = uuid(), meetingId = uuid(), eventId = uuid(), previousId = uuid(), taskId = uuid(), resourceId = uuid()
      data.projects.push({ id: projectId, name, description: `Sample records for ${name.toLowerCase()}.` })
      clients.push({ id: clientId, name: index ? 'Jordan Lee' : 'Alex Morgan', description: 'Sample client contact', email: index ? 'jordan@example.com' : 'alex@example.com', phone: '' })
      projectClients.push({ id: uuid(), projectId, clientId, active: true })
      snapshot.tasks.push({ id: taskId, projectId, title: index ? 'Review activation problems' : 'Resolve launch blocker', description: 'Review the linked issue and agree on next steps.', owner: index ? 'Jordan' : 'Alex', due: shiftDate(date, -2), duration: 45, priority: 'high', status: 'blocked' })
      snapshot.tasks.push({ id: uuid(), projectId, title: 'Prepare meeting talking points', description: 'Summarize project progress and open decisions.', owner: 'Me', due: shiftDate(date, -1), duration: 30, priority: 'medium', status: 'pending' })
      snapshot.events.push({ id: eventId, projectId, title: `${name} review`, date: shiftDate(date, 1), start: index ? '15:00' : '10:00', end: index ? '16:00' : '11:00', participants: [index ? 'Jordan Lee' : 'Alex Morgan'], agenda: '', category: 'meeting' })
      meetings.push({ id: meetingId, projectId, clientId, eventId, title: `${name} review`, date: shiftDate(date, 1), start: index ? '15:00' : '10:00', end: index ? '16:00' : '11:00', participants: [index ? 'Jordan Lee' : 'Alex Morgan'], agenda: '' })
      meetings.push({ id: previousId, projectId, clientId, title: 'Previous project review', date: shiftDate(date, -7), start: '10:00', end: '11:00', participants: [], agenda: '' })
      relationships.push({ id: uuid(), sourceKind: 'meeting', sourceId: meetingId, targetKind: 'meeting', targetId: previousId, type: 'previous_meeting' })
      relationships.push({ id: uuid(), sourceKind: 'meeting', sourceId: meetingId, targetKind: 'task', targetId: taskId, type: 'related' })
      resources.push({ id: resourceId, projectId, title: 'Project brief', kind: 'document', context: name, body: `Goals and decisions for ${name}.` })
      communications.push({ id: uuid(), projectId, clientId, date, sender: index ? 'Jordan' : 'Alex', subject: 'Review open questions', body: 'Please discuss the blocker and recent usage changes.' })
      issues.push({ id: uuid(), projectId, clientId, title: 'Onboarding friction', description: 'Users report difficulty completing onboarding.', status: 'open', owner: 'Me' })
      data.notes.push({ id: uuid(), projectId, title: 'Project notes', kind: 'general', draftKey: `project-outline:${projectId}` })
      data.notes.push({ id: uuid(), projectId, title: 'Meeting agenda', kind: 'agenda', draftKey: `meeting-agenda:${meetingId}`, meetingId } as typeof data.notes[number])
      data.notes.push({id:uuid(),projectId,title:'Previous meeting agenda',kind:'agenda',draftKey:`meeting-agenda:${previousId}`,meetingId:previousId} as typeof data.notes[number])
      snapshot.drafts[`meeting-agenda:${previousId}`] = 'Review progress and outstanding work.'
      snapshot.drafts[`meeting-agenda:${meetingId}`] = 'Review progress\nDiscuss the blocker\nAgree on next steps'
      for (let day = -13; day <= 0; day++) for (const segment of ['web', 'mobile']) observations.push({ id: uuid(), projectId, clientId, date: shiftDate(date, day), segment, sessions: 150 + index * 30 - (day > -7 && segment === 'mobile' ? 65 : 0), source: 'synthetic' })
      releases.push({ id: uuid(), projectId, clientId, date: shiftDate(date, -6), title: 'Onboarding update', description: 'Sample release timing; correlation does not establish causation.', segments: ['mobile'], source: 'synthetic' })
    }
    Object.assign(collections, { clients, projectClients, meetings, communications, issues, resources, usageObservations: observations, usageReleases: releases, relationships })
    data.projectSettings.selectedProjectId = data.projects[1].id
    data.workspaceDocument.active = PRESETS.home.widgets.map(widget => ({ ...makeInstance(widget.id, { kind:'workspace', projectId:data.projects[1].id, ...(widget.id === 'outline' ? {draftKey:`project-outline:${data.projects[1].id}`} : {}) }), span:widget.span }))
    const memory: StorageAdapter = { readJson: () => ({ status: 'missing' }), readString: () => ({ status: 'missing' }), writeJson: () => ({ status: 'saved' }), writeString: () => ({ status: 'saved' }), remove: () => ({ status: 'saved' }) }
    const candidate = createBrowserDatabase(memory, snapshot, collections)
    if (!createAdaptiveDataService(candidate).snapshot() || !createUsageDataService(candidate).snapshot()) return { ok: false as const, message: 'Sample records failed validation. Nothing was installed.' }
    const saved = database.replaceAll(snapshot, collections)
    return saved.status === 'invalid' ? { ok: false as const, message: 'Sample data could not be installed.' } : { ok: true as const, value: undefined }
  } }
}
