import { makeInstance } from '../domain/widgetInstances.ts'
import { PRESETS } from '../lib/workspace/config.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { freshProjectData, emptyRecords } from './projectDataService.ts'
import { calendarDate, shiftDate } from '../domain/calendar.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageDataService } from './usageDataService.ts'
import { createBrowserDatabase } from './browserDatabase.ts'
import { projectNoteSchema, type ProjectNote } from '../domain/projects.ts'
import { resourcePropertiesSchema, type ResourceProperties } from './resourceModuleService.ts'
import { activityRecordSchema, type ActivityRecord } from './recordHistory.ts'
import { persistedSchema } from './workspaceService.ts'
import type { Task, Event } from '../domain/types.ts'
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
    const noteRecords: ProjectNote[] = [projectNoteSchema.parse(data.notes[0])]
    const recordActivity: ActivityRecord[] = []
    const resourceProperties: Record<string, ResourceProperties> = {}
    const timestamp = (offset: number) => `${shiftDate(date, offset)}T09:00:00.000Z`
    const addNote = (projectId: string, title: string, body: string, kind: ProjectNote['kind'] = 'general', draftKey?: string, meetingId?: string, pinned = false) => {
      const id = uuid(), key = draftKey ?? `note:${id}`
      noteRecords.push({ id, projectId, title, kind, draftKey: key, meetingId, pinned, createdAt: timestamp(-7), updatedAt: timestamp(-1) })
      snapshot.drafts[key] = body
    }
    const clients: unknown[] = [], projectClients: unknown[] = [], meetings: unknown[] = [], communications: unknown[] = [], issues: unknown[] = [], resources: unknown[] = [], observations: unknown[] = [], releases: unknown[] = [], relationships: unknown[] = []
    for (const [index, name] of ['Website launch', 'Mobile onboarding'].entries()) {
      const projectId = uuid(), clientId = uuid(), taskId = uuid(), resourceId = uuid()
      const contact = index ? 'Jordan Lee' : 'Alex Morgan'
      data.projects.push({ id: projectId, name, description: `Sample records for ${name.toLowerCase()}.` })
      clients.push({ id: clientId, name: contact, description: 'Sample client contact', email: index ? 'jordan@example.com' : 'alex@example.com', phone: '' })
      projectClients.push({ id: uuid(), projectId, clientId, active: true })
      const taskInputs: Array<{ title: string; offset: number; duration: number; priority: Task['priority']; status: Task['status']; owner: string }> = [
        { title: index ? 'Review activation problems' : 'Resolve launch blocker', offset: -2, duration: 45, priority: 'high', status: 'blocked', owner: contact },
        { title: 'Prepare meeting talking points', offset: -1, duration: 30, priority: 'medium', status: 'pending', owner: 'Me' },
        { title: 'Verify the release checklist', offset: 0, duration: 60, priority: 'urgent', status: 'pending', owner: 'Me' },
        { title: 'Review client feedback', offset: 0, duration: 45, priority: 'high', status: 'pending', owner: contact },
        { title: 'Update project documentation', offset: 2, duration: 30, priority: 'low', status: 'pending', owner: 'Me' },
        { title: 'Confirm approval from the client', offset: 4, duration: 20, priority: 'medium', status: 'blocked', owner: contact },
        { title: 'Publish the project brief', offset: -3, duration: 30, priority: 'low', status: 'completed', owner: 'Me' },
        { title: 'Check baseline usage metrics', offset: -1, duration: 45, priority: 'medium', status: 'completed', owner: contact },
      ]
      const projectTasks = taskInputs.map((task, position) => ({ id: position ? uuid() : taskId, projectId, title: task.title, description: `Follow up on ${task.title.toLowerCase()} for ${name}.`, owner: task.owner, due: shiftDate(date, task.offset), duration: task.duration, priority: task.priority, status: task.status }))
      snapshot.tasks.push(...projectTasks)
      for (const task of projectTasks.filter(task => task.status === 'completed')) recordActivity.push({ id: uuid(), at: `${task.due}T12:00:00.000Z`, operation: 'sample_completion', kind: 'task', entityId: task.id, summary: `Sample history: completed ${task.title} for ${name}.`, completion: true })
      const addEvent = (title: string, offset: number, start: string, end: string, category: Event['category'], body: string, withClient = false) => {
        const eventId = uuid(), meetingId = category === 'meeting' ? uuid() : undefined
        const participants = category === 'meeting' ? withClient ? ['Me', contact] : ['Me', 'Sam Rivera'] : []
        snapshot.events.push({ id: eventId, projectId, ...(withClient ? { clientId } : {}), title, date: shiftDate(date, offset), start, end, participants, agenda: category === 'meeting' ? '' : body, category })
        if (meetingId) {
          meetings.push({ id: meetingId, eventId, projectId, ...(withClient ? { clientId } : {}), title, date: shiftDate(date, offset), start, end, participants, agenda: '' })
          addNote(projectId, title + ' agenda', body, 'agenda', `meeting-agenda:${meetingId}`, meetingId)
        }
        return meetingId
      }
      const previousId = addEvent('Previous project review', -7, '10:00', '11:00', 'meeting', 'Reviewed baseline usage and published the project brief. Follow up on the outstanding blocker.', true)!
      addEvent('Project stand-up', 0, '09:00', '09:30', 'meeting', 'Share progress, flag blockers, and confirm today’s priorities.')
      addEvent('Focus: verify the release checklist', 0, '10:00', '11:00', 'focus', 'Work through the release checklist without interruptions.')
      addEvent('Lunch break', 0, '12:30', '13:00', 'break', 'Time away from the desk.')
      const todayMeetingId = addEvent(`${name} client check-in`, 0, '14:00', '14:45', 'meeting', 'Review client feedback and prepare decisions for tomorrow’s review.', true)!
      addEvent('Focus: review client feedback', 0, '16:00', '16:45', 'focus', 'Summarize feedback and prepare next steps.')
      const meetingId = addEvent(`${name} review`, 1, index ? '15:00' : '10:00', index ? '16:00' : '11:00', 'meeting', 'Review progress\nDiscuss the blocker\nCompare web and mobile usage\nAgree on next steps', true)!
      addEvent('Product learning session', 3, '11:00', '12:00', 'class', 'Review the onboarding flow and gather improvement ideas.')
      addEvent('Internal planning', 5, '09:30', '10:15', 'meeting', 'Prioritize upcoming work and confirm owners.')
      const nextMeetingId = addEvent(`${name} follow-up`, 8, '14:00', '14:45', 'meeting', 'Check progress against review decisions and revisit unresolved issues.', true)!
      for (const [currentId, priorId] of [[todayMeetingId, previousId], [meetingId, previousId], [nextMeetingId, meetingId]]) relationships.push({ id: uuid(), sourceKind: 'meeting', sourceId: currentId, targetKind: 'meeting', targetId: priorId, type: 'previous_meeting' })
      relationships.push({ id: uuid(), sourceKind: 'meeting', sourceId: meetingId, targetKind: 'task', targetId: taskId, type: 'related' })
      const resourceInputs = [
        { id: resourceId, title: 'Project brief', kind: 'document', body: `Goals for ${name}: improve onboarding, resolve the blocker, and agree on a measurable release checklist.`, tags: ['brief', 'planning'] },
        { id: uuid(), title: 'Client feedback summary', kind: 'note', body: 'The client wants clearer onboarding instructions and a confirmed delivery date. Review the open issues before making commitments.', tags: ['feedback', 'meeting'] },
        { id: uuid(), title: 'Reference link', kind: 'link', body: 'https://example.com/', tags: ['reference'] },
        { id: uuid(), title: 'Release checklist', kind: 'document', body: 'Verify critical journeys. Check mobile onboarding. Confirm owners. Review monitoring after release.', tags: ['release', 'checklist'] },
      ]
      for (const resource of resourceInputs) {
        resources.push({ id: resource.id, projectId, title: resource.title, kind: resource.kind, context: name, body: resource.body })
        resourceProperties[resource.id] = { description: `Synthetic ${resource.title.toLowerCase()} for ${name}.`, tags: resource.tags, links: [{ kind: 'meeting', id: meetingId }, { kind: 'task', id: taskId }] }
        relationships.push({ id: uuid(), sourceKind: 'meeting', sourceId: meetingId, targetKind: 'resource', targetId: resource.id, type: 'related' })
      }
      for (const [offset, subject, body] of [
        [-5, 'Previous review follow-up', 'The project brief is approved. Please follow up on the unresolved blocker.'],
        [-2, 'Mobile feedback', 'Some users struggle with onboarding on mobile. Compare the recent usage records.'],
        [-1, 'Confirm review priorities', 'Please cover release readiness, the outstanding blocker, and next steps.'],
        [0, 'Questions for tomorrow', 'Which changes can we ship safely, and who will own the follow-up?'],
      ] as const) communications.push({ id: uuid(), projectId, clientId, ...(offset === 0 ? { meetingId } : {}), date: shiftDate(date, offset), sender: contact, subject, body })
      issues.push({ id: uuid(), projectId, clientId, meetingId, title: 'Onboarding friction', description: 'Users report difficulty completing onboarding. Compare mobile usage before and after the update.', status: 'open', owner: 'Me' })
      issues.push({ id: uuid(), projectId, clientId, title: 'Approval pending', description: 'Confirm delivery approval before releasing the changes.', status: 'open', owner: contact })
      issues.push({ id: uuid(), projectId, clientId, title: 'Project brief corrections', description: 'The client approved the corrected brief during the previous review.', status: 'closed', owner: 'Me' })
      addNote(projectId, 'Project notes', `Goals for ${name}\nResolve the blocker\nPrepare the client review\nCheck release readiness`, 'general', `project-outline:${projectId}`)
      addNote(projectId, 'Review priorities', 'Discuss the blocker first. Compare mobile and web usage. Record owners and next steps.', 'general', undefined, undefined, true)
      addNote(projectId, 'Decisions and next steps', 'The project brief is approved. Release approval remains pending. Update the checklist before the client review.')
      addNote(projectId, 'Usage investigation', 'Compare the two seven-day periods for mobile and web. Check the onboarding release timing; correlation alone does not establish a cause.', 'investigation', `project-investigation:${projectId}`)
      for (let day = -13; day <= 0; day++) for (const segment of ['web', 'mobile']) observations.push({ id: uuid(), projectId, clientId, date: shiftDate(date, day), segment, sessions: 150 + index * 30 - (day > -7 && segment === 'mobile' ? 65 : 0), source: 'synthetic' })
      releases.push({ id: uuid(), projectId, clientId, date: shiftDate(date, -6), title: 'Onboarding update', description: 'Sample release timing; correlation does not establish causation.', segments: ['mobile'], source: 'synthetic' })
    }
    Object.assign(collections, { clients, projectClients, meetings, communications, issues, resources, usageObservations: observations, usageReleases: releases, relationships, notes: noteRecords, resourceProperties, recordActivity: recordActivity.sort((a, b) => b.at.localeCompare(a.at)) })
    data.projectSettings.selectedProjectId = data.projects[1].id
    data.workspaceDocument.active = PRESETS.home.widgets.map(widget => ({ ...makeInstance(widget.id, { kind:'workspace', projectId:data.projects[1].id, ...(widget.id === 'outline' ? {draftKey:`project-outline:${data.projects[1].id}`} : {}) }), span:widget.span }))
    const memory: StorageAdapter = { readJson: () => ({ status: 'missing' }), readString: () => ({ status: 'missing' }), writeJson: () => ({ status: 'saved' }), writeString: () => ({ status: 'saved' }), remove: () => ({ status: 'saved' }) }
    const candidate = createBrowserDatabase(memory, snapshot, collections)
    if (!persistedSchema.safeParse(snapshot).success || !projectNoteSchema.array().safeParse(noteRecords).success || !activityRecordSchema.array().safeParse(recordActivity).success || !Object.values(resourceProperties).every(properties => resourcePropertiesSchema.safeParse(properties).success) || !createAdaptiveDataService(candidate).snapshot() || !createUsageDataService(candidate).snapshot()) return { ok: false as const, message: 'Sample records failed validation. Nothing was installed.' }
    const saved = database.replaceAll(snapshot, collections)
    return saved.status === 'invalid' ? { ok: false as const, message: 'Sample data could not be installed.' } : { ok: true as const, value: undefined }
  } }
}
