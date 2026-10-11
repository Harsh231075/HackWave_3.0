import { createNoteService } from './noteService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { DomainSnapshot } from '../domain/types.ts'
import { projectClientSchema, projectNoteSchema, projectSettingsSchema } from '../domain/projects.ts'
import { adaptiveProjectSchema, clientSchema } from '../domain/adaptiveData.ts'
import { makeInstance } from '../domain/widgetInstances.ts'
import { PRESETS } from '../lib/workspace/config.ts'
import { emptyWorkspace } from '../domain/workspaceDocument.ts'
import { createCollection } from './local/collection.ts'

export const emptyRecords = (): DomainSnapshot => ({ tasks: [], events: [], drafts: {}, dismissed: [], activity: [] })
export function freshProjectData() {
  const id = crypto.randomUUID()
  return { projects: [{ id, name: 'Default', description: '' }], clients: [], projectClients: [], notes: [{ id: crypto.randomUUID(), projectId: id, title: 'Project notes', kind: 'general', draftKey: `project-outline:${id}` }], meetings: [], communications: [], issues: [], relationships: [], resources: [], usageObservations: [], usageReleases: [], files: [],
    projectSettings: { version: 2, defaultProjectId: id, selectedProjectId: id }, workspaceDocument: { ...emptyWorkspace(), active: PRESETS.home.widgets.map(widget => ({ ...makeInstance(widget.id, { kind: 'workspace', projectId: id, ...(widget.id === 'outline' ? { draftKey: `project-outline:${id}` } : {}) }), span: widget.span })) } }
}
// Explicitly owned legacy keys; never clear unrelated origin storage or OAuth sessions.
const legacyKeys = ['gogpt-workspace-v1', 'orlo-browser-db-v1', 'gogpt-app-layout-v1', 'orlo-continuous-workspace-v1', 'gogpt-workspace-layout-v1', 'gogpt-workspace-v1-layout', 'gogpt-workspace-v1-pins', 'orlo-workspace-conversation-v1', 'orlo-live-calendar-layout-v1', 'orlo-layout-v1', 'task-view', 'calendar-view', 'calendar-category']
export function createProjectDataService(database: BrowserDatabase) {
  const settings = () => {
    const loaded = database.readCollection('projectSettings')
    const parsed = projectSettingsSchema.safeParse(loaded.status === 'found' ? loaded.value : null)
    return parsed.success ? parsed.data : null
  }
  const projects = createCollection(database, 'projects', adaptiveProjectSchema)
  const clients = createCollection(database, 'clients', clientSchema)
  const associations = createCollection(database, 'projectClients', projectClientSchema)
  const notes = createCollection(database, 'notes', projectNoteSchema)
  const projectExists = (id?: string) => !!id && !!projects.getById(id)
  const result = (message: string) => ({ ok: false as const, message })
  return {
    settings, projects, clients,
    isProjectMode: () => !!settings(),
    compatible: () => database.readCollection('projectSettings').status !== 'invalid',
    selectedId: () => { const s = settings(); return s && projectExists(s.selectedProjectId) ? s.selectedProjectId : s?.defaultProjectId },
    select(id: string) { const s = settings(); return !s || !projectExists(id) ? result('Choose an available project.') : database.writeCollection('projectSettings', { ...s, selectedProjectId: id }).status === 'invalid' ? result('Project selection could not be saved.') : { ok: true as const, value: undefined } },
    create(name: string, description = '') {
      if (!name.trim() || name.length > 160 || description.length > 5000) return result('Enter a project name.')
      return database.transaction(() => {
        const added = projects.create({ name: name.trim(), description })
        if (!added.ok) return added
        const addedNote = notes.create({ projectId: added.value.id, title: 'Project notes', kind: 'general', pinned: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), draftKey: `project-outline:${added.value.id}` })
        return addedNote.ok ? added : addedNote
      })
    },
    delete(id: string) {
      if (settings()?.defaultProjectId === id) return result('The Default project cannot be deleted.')
      const state = database.getState()
      if ([...state.tasks, ...state.events].some(record => record.projectId === id) || notes.list().some(note => note.projectId === id && (state.drafts[note.draftKey] ?? '').length)) return result('Move or remove this project’s records first.')
      for (const key of ['meetings', 'resources', 'issues', 'communications', 'usageObservations', 'usageReleases', 'files']) {
        const data = database.readCollection(key)
        if (data.status === 'found' && Array.isArray(data.value) && data.value.some(record => record.projectId === id)) return result('Move or remove this project’s records first.')
      }
      return database.transaction(() => {
        const deleted = projects.delete(id)
        if (!deleted.ok) return deleted
        for(const note of notes.list().filter(note=>note.projectId===id)) if(Object.hasOwn(state.drafts,note.draftKey)) database.dispatch({type:'delete-draft',key:note.draftKey})
        database.writeCollection('notes', notes.list().filter(note => note.projectId !== id))
        database.writeCollection('projectClients', associations.list().filter(link => link.projectId !== id))
        const s = settings()
        if (s?.selectedProjectId === id) database.writeCollection('projectSettings', { ...s, selectedProjectId: s.defaultProjectId })
        return deleted
      })
    },
    clientLinks: (projectId: string, activeOnly = true) => associations.list().filter(link => link.projectId === projectId && (!activeOnly || link.active)),
    addClient(projectId: string, clientId: string) {
      if (!projectExists(projectId) || !clients.getById(clientId)) return result('Choose a valid project and client.')
      const existing = associations.list().find(link => link.projectId === projectId && link.clientId === clientId)
      return existing ? associations.update(existing.id, { active: true }) : associations.create({ projectId, clientId, active: true })
    },
    removeClient(projectId: string, clientId: string) {
      const link = associations.list().find(link => link.projectId === projectId && link.clientId === clientId)
      return link ? associations.update(link.id, { active: false }) : result('This client is not attached to the project.')
    },
    notes: {
      list: (projectId?: string) => notes.list().filter(note => !projectId || note.projectId === projectId),
      create: (projectId: string, title: string, body = '') => createNoteService(database).create(projectId, { title, body }),
      rename(id: string, title: string) { const service = createNoteService(database), note = service.getById(id); return note ? service.update(id, { title, body: note.body }, note) : result('This note is unavailable.') },
      delete(id: string) { const service = createNoteService(database), note = service.getById(id); return note ? service.delete(id, note) : result('This note is unavailable.') },
    },
    reset() {
      const removed = legacyKeys.map(key => database.storage.remove(key))
      const saved = database.replaceAll(emptyRecords(), freshProjectData())
      return removed.some(result => result.status !== 'saved') && saved.status === 'saved' ? { status: 'unavailable' as const } : saved
    },
  }
}
