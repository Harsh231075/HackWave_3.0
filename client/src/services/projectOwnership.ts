import type { BrowserDatabase } from './browserDatabase.ts'
import { projectSettingsSchema } from '../domain/projects.ts'
export function projectSettings(database: BrowserDatabase) {
  const raw = database.readCollection('projectSettings')
  const parsed = projectSettingsSchema.safeParse(raw.status === 'found' ? raw.value : null)
  return parsed.success ? parsed.data : null
}
export function validProject(database: BrowserDatabase, projectId?: string) {
  if (!projectSettings(database)) return database.readCollection('projectSettings').status !== 'invalid'
  const projects = database.readCollection('projects')
  return !!projectId && projects.status === 'found' && Array.isArray(projects.value) && projects.value.some(project => project.id === projectId)
}
export function draftProject(database: BrowserDatabase, key: string): string | undefined {
  const notes = database.readCollection('notes')
  if (notes.status === 'found' && Array.isArray(notes.value)) { const note = notes.value.find(note => note.draftKey === key); if (note) return note.projectId }
  if (key.startsWith('meeting-agenda:')) {
    const meetings = database.readCollection('meetings')
    if (meetings.status === 'found' && Array.isArray(meetings.value)) return meetings.value.find(meeting => meeting.id === key.slice('meeting-agenda:'.length))?.projectId
  }
  if (key.startsWith('google-preparation:')) return projectSettings(database)?.selectedProjectId
  if (key.startsWith('project-outline:')) return key.slice('project-outline:'.length)
  if (key.startsWith('project-investigation:')) return key.slice('project-investigation:'.length)
  return undefined
}
