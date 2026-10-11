import { useState } from 'react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { draftService, projectDataService, browserDatabase } from '@/services'
import { draftProject } from '@/services/projectOwnership'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DraftEditor } from './DraftEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function DraftLibrary({ draftKey }: { draftKey: string }) {
  const { state, notify, editDraft } = useWorkspace()
  const projectId = draftProject(browserDatabase, draftKey) ?? projectDataService.selectedId()
  const notes = projectDataService.notes.list(projectId)
  const [open, setOpen] = useState(false), [selectedId, setSelectedId] = useState(''), [name, setName] = useState(''), [remove, setRemove] = useState(false)
  const selected = notes.find(note => note.id === selectedId)
  const report = (result: { ok: boolean; message?: string }) => { if (!result.ok) notify(result.message ?? 'Unable to update note.') }
  const create = (body = '') => {
    if (!projectId || !name.trim()) return
    const result = projectDataService.notes.create(projectId, name.trim(), body)
    report(result)
    if (result.ok) { setSelectedId(result.value.id); setName('') }
  }
  return <><div className="mb-3"><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Notes library</Button></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Project notes</DialogTitle><DialogDescription>Notes and agendas for this project.</DialogDescription></DialogHeader>
      <label className="text-sm">Note name<Input aria-label="Note name" value={name} onChange={event => setName(event.target.value)} maxLength={160} /></label>
      <div className="flex flex-wrap gap-2"><Button disabled={!name.trim()} onClick={() => create()}>Create note</Button>{selected && <><Button variant="outline" disabled={!name.trim()} onClick={() => { report(projectDataService.notes.rename(selected.id, name.trim())); setName('') }}>Rename note</Button><Button variant="outline" disabled={!name.trim()} onClick={() => create(state.drafts[selected.draftKey] ?? '')}>Duplicate note</Button></>}</div>
      <select aria-label="Select note" className="rounded border p-2" value={selectedId} onChange={event => { setSelectedId(event.target.value); setRemove(false) }}><option value="">Select a note</option>{notes.map(note => <option key={note.id} value={note.id}>{note.title}</option>)}</select>
      {selected && <><DraftEditor key={selected.id} draftKey={selected.draftKey} label={selected.title} onSave={body => draftService.save(selected.draftKey, body)} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { const url = URL.createObjectURL(new Blob([state.drafts[selected.draftKey] ?? ''], { type: 'text/markdown' })); const link = document.createElement('a'); link.href = url; link.download = selected.title + '.md'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}>Export saved note</Button><Button variant="outline" onClick={() => { editDraft(draftKey, state.drafts[selected.draftKey] ?? ''); setOpen(false) }}>Copy into this draft</Button>{selected.kind === 'general' && !selected.draftKey.startsWith('project-outline:') && <Button variant="destructive" onClick={() => setRemove(true)}>Delete note</Button>}</div></>}
      {remove && selected && <div className="space-y-2 rounded border p-3"><p>Delete “{selected.title}”?</p><Button variant="destructive" onClick={() => { const result = projectDataService.notes.delete(selected.id); report(result); if (result.ok) { setSelectedId(''); setRemove(false) } }}>Confirm delete note</Button><Button variant="outline" onClick={() => setRemove(false)}>Keep note</Button></div>}
    </DialogContent></Dialog></>
}
