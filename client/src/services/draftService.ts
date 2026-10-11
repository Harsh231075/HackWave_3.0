import { createCollection } from './local/collection.ts'
import { projectNoteSchema } from '../domain/projects.ts'
import { draftProject, projectSettings, validProject } from './projectOwnership.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
export function createDraftService(database: BrowserDatabase) {
  return {
    get: (key: string) => database.getState().drafts[key] ?? null,
    save(key: string, value: string): ActionResult<void> {
      if (!validProject(database, draftProject(database, key))) return { ok: false, message: 'This note needs an available project.' }
      if (!key || value.length > 5000) return { ok: false, message: 'Keep your draft under 5000 characters.' }
      if(projectSettings(database)) { const notes = createCollection(database, 'notes', projectNoteSchema); if (!notes.list().some(note=>note.draftKey===key)) { const projectId = draftProject(database,key)!; const note = notes.create({ projectId, title: key.startsWith('meeting-agenda:') ? 'Meeting agenda' : 'Investigation notes', kind: key.startsWith('meeting-agenda:') ? 'agenda' : key.startsWith('project-outline:') ? 'general' : 'investigation', draftKey: key }); if (!note.ok) return note } }
      database.dispatch({ type: 'draft', key, value }); return { ok: true, value: undefined }
    },
    rename(key:string,newKey:string):ActionResult<void>{if(projectSettings(database))return {ok:false,message:'Rename the note title in Project notes.'};if(!key.startsWith('note:')||!newKey.startsWith('note:')||newKey.length>165||!newKey.slice(5).trim()||!Object.hasOwn(database.getState().drafts,key)||Object.hasOwn(database.getState().drafts,newKey))return {ok:false,message:'Choose an unused name for a local note.'};database.dispatch({type:'rename-draft',key,newKey});return {ok:true,value:undefined}},
    delete(key: string): ActionResult<void> {
      if (!Object.hasOwn(database.getState().drafts, key)) return { ok: false, message: 'This draft is no longer available.' }
      database.dispatch({ type: 'delete-draft', key }); return { ok: true, value: undefined }
    },
  }
}
