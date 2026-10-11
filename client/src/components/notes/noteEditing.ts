import toast from 'react-hot-toast'
import { browserDatabase, noteService } from '@/services'
import type { Note, NoteSnapshot } from '@/services/noteService'
interface Buffer { value: NoteSnapshot; baseline: NoteSnapshot; error: string; dirty: boolean; timer?: ReturnType<typeof setTimeout>; epoch: number }
const buffers = new Map<string, Buffer>()
const listeners = new Set<() => void>()
let revision = 0
const emit = () => { revision++; listeners.forEach(listener => listener()) }
export const subscribeEdits = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
export const editsRevision = () => revision
export function noteBuffer(note: Note) { const buffer = buffers.get(note.id); return buffer?.epoch === browserDatabase.getEpoch() ? buffer : undefined }
export function flushNote(id: string) {
  const buffer = buffers.get(id)
  if (!buffer) return
  clearTimeout(buffer.timer)
  if (buffer.epoch !== browserDatabase.getEpoch()) { buffers.delete(id); emit(); return }
  if (!buffer.dirty || buffer.error) return
  const result = noteService.update(id, { ...buffer.value, title: buffer.value.title.trim() || 'Untitled note' }, buffer.baseline)
  if (result.ok) { buffers.delete(id); toast.success('Note updated.', { id: 'note-save', duration: 2500 }) }
  else { buffer.error = result.message; toast.error(result.message, { id: 'note-save' }) }
  emit()
}
export function editNote(note: Note, patch: Partial<NoteSnapshot>) {
  const buffer = noteBuffer(note) ?? { value: { title: note.title, body: note.body }, baseline: { title: note.title, body: note.body }, dirty: false, error: '', epoch: browserDatabase.getEpoch() }
  clearTimeout(buffer.timer)
  buffer.value = { ...buffer.value, ...patch }; buffer.dirty = true
  buffers.set(note.id, buffer)
  if (!buffer.error) buffer.timer = setTimeout(() => flushNote(note.id), 600)
  emit()
}
export function resolveNote(id: string, keepMine: boolean) {
  const buffer = buffers.get(id), note = noteService.getById(id)
  if (!buffer || !note) return
  clearTimeout(buffer.timer)
  if (!keepMine) buffers.delete(id)
  else { buffer.baseline = { title: note.title, body: note.body }; buffer.error = ''; flushNote(id) }
  emit()
}
export function discardNote(id: string) { clearTimeout(buffers.get(id)?.timer); buffers.delete(id); emit() }
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    buffers.forEach((_, id) => flushNote(id))
    if ([...buffers.values()].some(buffer => buffer.epoch === browserDatabase.getEpoch() && buffer.dirty)) { event.preventDefault(); event.returnValue = '' }
  })
  browserDatabase.subscribe(() => {
    let changed = false
    buffers.forEach((buffer, id) => { if (buffer.epoch !== browserDatabase.getEpoch() || !noteService.getById(id)) { clearTimeout(buffer.timer); buffers.delete(id); changed = true } })
    if (changed) emit()
  })
}
