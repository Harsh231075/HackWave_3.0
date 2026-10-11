import { createCollection } from './local/collection.ts'
import { noteSchema, type NoteRecord } from '../domain/notes.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
export type Note = NoteRecord & { body: string }
export type NoteSnapshot = Pick<Note, 'title' | 'body'>
export function createNoteService(database: BrowserDatabase) {
  const records = createCollection(database, 'notes', noteSchema)
  const getById = (id: string): Note | null => { const note = records.getById(id); return note ? { ...note, body: database.getState().drafts[note.draftKey] ?? '' } : null }
  const fail = (message: string) => ({ ok: false as const, message })
  const editable = (note: Note) => note.kind === 'general' && note.draftKey.startsWith('note:')
  const update = (id: string, input: NoteSnapshot, expected: NoteSnapshot): ActionResult<Note> => {
    const note = getById(id)
    if (!note) return fail('This note is no longer available.')
    if (note.title !== expected.title || note.body !== expected.body) return fail('This note changed elsewhere. Review the saved version or keep your edits.')
    if (!input.title.trim() || input.title.length > 160 || input.body.length > 5000) return fail('Use a title under 160 characters and a note under 5000 characters.')
    if (note.title === input.title.trim() && note.body === input.body) return { ok: true, value: note }
    return database.transaction(() => {
      const saved = records.update(id, { title: input.title.trim(), createdAt: note.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() })
      if (!saved.ok) return saved
      if (note.body !== input.body) database.dispatch({ type: 'draft', key: note.draftKey, value: input.body })
      return { ok: true, value: getById(id)! }
    })
  }
  const create = (input: NoteSnapshot): ActionResult<Note> => {
    if ((!input.title.trim() && !input.body.trim()) || input.title.length > 160 || input.body.length > 5000) return fail('Enter a note within the title and body limits.')
    const id = crypto.randomUUID(), now = new Date().toISOString()
    return database.transaction(() => {
      const saved = records.save({ id, title: input.title.trim() || 'Untitled note', kind: 'general', draftKey: `note:${id}`, pinned: false, createdAt: now, updatedAt: now })
      if (!saved.ok) return saved
      database.dispatch({ type: 'draft', key: saved.value.draftKey, value: input.body })
      return { ok: true, value: getById(id)! }
    })
  }
  return {
    getById, create, update, canDelete: editable,
    list(query = '') { const search = query.trim().toLocaleLowerCase(); return records.list().map(note => getById(note.id)!).filter(note => !search || `${note.title}\n${note.body}`.toLocaleLowerCase().includes(search)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '') || a.id.localeCompare(b.id)) },
    setPinned(id: string, pinned: boolean) { const note = getById(id); return note ? records.update(id, { pinned }) : fail('This note is unavailable.') },
    duplicate(id: string) { const note = getById(id); return note ? create({ title: `${note.title.slice(0, 153)} (copy)`, body: note.body }) : fail('This note is unavailable.') },
    delete(id: string, expected: NoteSnapshot): ActionResult<void> {
      const note = getById(id)
      if (!note) return fail('This note is unavailable.')
      const voice=database.readCollection('voiceNotes')
      if(voice.status==='found'&&Array.isArray(voice.value)&&voice.value.some(item=>item.noteId===id))return fail('Delete this voice note through its audio service.')
      if (!editable(note)) return fail('Linked notes cannot be deleted independently.')
      if (note.title !== expected.title || note.body !== expected.body) return fail('This note changed. Review it before deleting.')
      return database.transaction(() => { const result = records.delete(id); if (result.ok) database.dispatch({ type: 'delete-draft', key: note.draftKey }); return result })
    },
  }
}
