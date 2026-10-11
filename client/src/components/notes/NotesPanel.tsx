import { VoiceNotePlayback } from '@/extensions/voice-note/VoiceNote'
import { voiceNoteService } from '@/services'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Copy, Download, MoreHorizontal, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import { browserDatabase, noteService } from '@/services'
import type { Note } from '@/services/noteService'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { discardNote, editNote, editsRevision, flushNote, noteBuffer, resolveNote, subscribeEdits } from './noteEditing'

export function NoteActions({ note, onError }: { note: Note; onError: (message: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  return <><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label={`Actions for ${note.title}`} />}><MoreHorizontal size={16}/></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-48">
    <DropdownMenuItem onClick={() => { const result = noteService.duplicate(note.id); if (!result.ok) onError(result.message) }}><Copy/>Duplicate</DropdownMenuItem>
    <DropdownMenuItem onClick={() => { const saved = noteService.getById(note.id); if (!saved) return; const url = URL.createObjectURL(new Blob([`# ${saved.title}\n\n${saved.body}`], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = `${saved.title.replace(/[\\/:*?"<>|]/g, '-')}.md`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}><Download/>Export saved note</DropdownMenuItem>
    {noteService.canDelete(note) && <DropdownMenuItem variant="destructive" onClick={() => setConfirm(true)}><Trash2/>Delete</DropdownMenuItem>}
  </DropdownMenuContent></DropdownMenu><Dialog open={confirm} onOpenChange={setConfirm}><DialogContent><DialogHeader><DialogTitle>Delete “{note.title}”?</DialogTitle></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="destructive" onClick={async () => { const result = await voiceNoteService.deleteNote(note.id, note); if (result.ok === false) onError(result.message); else { discardNote(note.id); setConfirm(false); if('warning' in result && typeof result.warning==='string')onError(result.warning) } }}>Delete note</Button></div></DialogContent></Dialog></>
}
export function NoteCard({ note, onOpen, onError }: { note: Note; onOpen: () => void; onError: (message: string) => void }) {
  return <article className="rounded-xl border border-[#E8EAEE] bg-background p-4 transition-shadow hover:shadow-sm"><div className="flex items-start gap-2"><button className="min-w-0 flex-1 text-left font-medium break-words" onClick={onOpen}>{note.title}</button><Button variant="ghost" size="icon" aria-label={note.pinned ? `Unpin ${note.title}` : `Pin ${note.title}`} aria-pressed={note.pinned} onClick={() => { const result = noteService.setPinned(note.id, !note.pinned); if (!result.ok) onError(result.message) }}>{note.pinned ? <PinOff size={16}/> : <Pin size={16}/>}</Button></div><button className="mt-2 block min-h-12 w-full whitespace-pre-wrap break-words text-left text-sm text-muted-foreground line-clamp-6" aria-label={`Open ${note.title}`} onClick={onOpen}>{note.body || 'Empty note'}</button><div className="mt-3 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{note.kind !== 'general' ? note.kind === 'agenda' ? 'Meeting agenda' : 'Investigation' : note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ''}</span><NoteActions note={note} onError={onError}/></div></article>
}
export function NotesGrid({ notes, onOpen, onError }: { notes: Note[]; onOpen: (id: string) => void; onError: (message: string) => void }) {
  const pinned = notes.filter(note => note.pinned), others = notes.filter(note => !note.pinned)
  return <div className="space-y-6">{[pinned, others].map((group, index) => group.length > 0 && <section key={index}>{pinned.length > 0 && <h2 className="mb-3 text-xs font-medium text-muted-foreground">{index === 0 ? 'Pinned' : 'Other notes'}</h2>}<div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">{group.map(note => <NoteCard key={note.id} note={note} onOpen={() => onOpen(note.id)} onError={onError}/>)}</div></section>)}</div>
}
export function NoteEditor({ note }: { note: Note }) {
  useSyncExternalStore(subscribeEdits, editsRevision, editsRevision)
  const buffer = noteBuffer(note), value = buffer?.value ?? note
  useEffect(() => () => flushNote(note.id), [note.id])
  const status = buffer?.error ? '' : buffer?.dirty ? 'Saving…' : browserDatabase.getPersistenceResult().status === 'saved' ? 'Saved' : 'Saved for this session'
  return <div className="space-y-4"><Input aria-label="Note title" className="border-0 px-0 text-lg shadow-none" value={value.title} maxLength={160} onChange={event => editNote(note, { title: event.target.value })}/><Textarea aria-label="Note body" className="min-h-64 resize-y border-0 px-0 shadow-none" value={value.body} maxLength={5000} placeholder="Take a note…" onChange={event => editNote(note, { body: event.target.value })}/><VoiceNotePlayback noteId={note.id}/><p role="status" className="text-xs text-muted-foreground">{status}</p>{buffer?.error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{buffer.error}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => resolveNote(note.id, false)}>Use saved version</Button><Button onClick={() => resolveNote(note.id, true)}>Keep mine / Retry</Button></div></div>}</div>
}
export function NoteEditorDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  return <Dialog open onOpenChange={open => { if (!open) { flushNote(note.id); onClose() } }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle className="sr-only">Edit note</DialogTitle></DialogHeader><NoteEditor key={note.id} note={note}/></DialogContent></Dialog>
}
interface ComposerDraft { title: string; body: string; id: string; epoch: number; error: string; baseline: { title: string; body: string } }
const composerDrafts = new Map<string, ComposerDraft>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', event => {
    if ([...composerDrafts.values()].some(draft => draft.epoch === browserDatabase.getEpoch() && draft.error)) { event.preventDefault(); event.returnValue = '' }
  })
}
function getComposerDraft() {
  const existing = composerDrafts.get('new-note')
  if (existing?.epoch === browserDatabase.getEpoch()) return existing
  const draft = { title: '', body: '', id: '', epoch: browserDatabase.getEpoch(), error: '', baseline: { title: '', body: '' } }
  composerDrafts.set('new-note', draft)
  return draft
}
export function NoteComposer({ onClose }: {  onClose: () => void }) {
  const [title, setTitle] = useState(() => getComposerDraft().title), [body, setBody] = useState(() => getComposerDraft().body), [error, setError] = useState(() => getComposerDraft().error)
  const save = useRef(() => {})
  useEffect(() => { const draft = getComposerDraft(); save.current = () => {
    if (draft.epoch !== browserDatabase.getEpoch() || (!draft.title.trim() && !draft.body.trim())) return
    if (draft.id && (draft.title.trim() || 'Untitled note') === draft.baseline.title && draft.body === draft.baseline.body) return
    const existing = draft.id ? noteService.getById(draft.id) : null
    const result = existing ? noteService.update(existing.id, { title: draft.title.trim() || 'Untitled note', body: draft.body }, draft.baseline) : draft.id ? { ok: false as const, message: 'This note was removed.' } : noteService.create(draft)
    if (result.ok) { draft.id = result.value.id; draft.baseline = { title: result.value.title, body: result.value.body }; draft.error = ''; setError('') } else { draft.error = result.message; setError(result.message) }
  } }, [])
  useEffect(() => { const timer = setTimeout(() => save.current(), 600); return () => clearTimeout(timer) }, [title, body])
  useEffect(() => { const draft = getComposerDraft(); const flush = () => save.current(); const unload = (event: BeforeUnloadEvent) => { flush(); if (draft.error) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', unload); return () => { flush(); if (!draft.error && draft.epoch === browserDatabase.getEpoch()) Object.assign(draft, { title: '', body: '', id: '', error: '', baseline: { title: '', body: '' } }); window.removeEventListener('beforeunload', unload) } }, [])
  const clear = () => { Object.assign(getComposerDraft(), { title: '', body: '', id: '', epoch: browserDatabase.getEpoch(), error: '', baseline: { title: '', body: '' } }); setTitle(''); setBody(''); setError('') }
  const close = () => { save.current(); if (!getComposerDraft().error) { clear(); onClose() } }
  return <div className="space-y-4"><Input aria-label="New note title" placeholder="Title" maxLength={160} className="border-0 shadow-none" value={title} onChange={event => { setTitle(event.target.value); getComposerDraft().title = event.target.value }}/><Textarea aria-label="New note body" placeholder="Take a note…" rows={7} maxLength={5000} className="min-h-0 resize-none border-0 shadow-none" value={body} onChange={event => { setBody(event.target.value); getComposerDraft().body = event.target.value }}/><div className="flex justify-end"><Button variant="ghost" onClick={close}>Close</Button></div>{error && <div role="alert" className="space-y-2"><p className="text-sm text-destructive">{error}</p><div className="flex gap-2"><Button variant="outline" onClick={clear}>Use saved version</Button><Button onClick={() => { const draft = getComposerDraft(); const saved = noteService.getById(draft.id); if (saved) { draft.baseline = { title: saved.title, body: saved.body }; save.current() } else if (!draft.id) save.current() }}>Keep mine / Retry</Button></div></div>}</div>
}
export function NewNoteButton() {
  const [open, setOpen] = useState(false)
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus size={16}/>New note</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>New note</DialogTitle></DialogHeader>{open && <NoteComposer  onClose={() => setOpen(false)}/>}</DialogContent></Dialog></>
}
export function NotesPanel({ query = '', focusedDraftKey, showCreateButton = true }: {  query?: string; focusedDraftKey?: string; showCreateButton?: boolean }) {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const [selectedId, setSelectedId] = useState(''), [error, setError] = useState('')
  const notes = noteService.list(query), selected = noteService.getById(selectedId)
  const focused = focusedDraftKey ? noteService.list().find(note => note.draftKey === focusedDraftKey) : undefined
  if (focusedDraftKey) return focused ? <NoteEditor key={focused.id} note={focused}/> : <p className="text-sm text-muted-foreground">This note is unavailable.</p>
  return <div>{showCreateButton && <WidgetActions><NewNoteButton /></WidgetActions>}{error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}{notes.length ? <NotesGrid notes={notes} onOpen={setSelectedId} onError={setError}/> : <p className="py-8 text-center text-sm text-muted-foreground">{query ? 'No matching notes' : 'No notes yet'}</p>}{selected && <NoteEditorDialog note={selected} onClose={() => setSelectedId('')}/>}</div>
}
