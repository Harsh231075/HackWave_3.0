import { useState } from 'react'
import { useProject } from '@/hooks/useProject'
import { projectDataService, projectSeedService } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { RecordManager } from './RecordManager'
import { clientSpec } from './recordSpecs'

export function LocalDataSettings() {
  const { resetDemo, notify } = useWorkspace()
  const [confirm, setConfirm] = useState(false)
  return <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-medium">Local data</h3><p className="text-sm text-muted-foreground">Reset removes local projects, records, notes, attachments, layouts, pins and preferences. External calendars are unaffected.</p>
    {confirm ? <div className="flex flex-wrap gap-2"><Button variant="destructive" onClick={() => { setConfirm(false); resetDemo() }}>Confirm reset local data</Button><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button></div> : <Button variant="destructive" onClick={() => setConfirm(true)}>Reset local data</Button>}
    <Button className="ml-2" variant="outline" onClick={() => { const result = projectSeedService.seed(); notify(result.ok ? 'Sample project data added.' : result.message) }}>Seed sample data</Button>
  </section>
}
export function ProjectControls() {
  const { projects, selectedId, project, compatible } = useProject()
  const { notify } = useWorkspace()
  const [open, setOpen] = useState(false), [name, setName] = useState(''), [description, setDescription] = useState(''), [clientId, setClientId] = useState(''), [deleting, setDeleting] = useState(false)
  if (!compatible) return null
  const report = (result: { ok: boolean; message?: string }) => { if (!result.ok) notify(result.message ?? 'Unable to update the project.') }
  const active = projectDataService.clientLinks(selectedId ?? '')
  const clients = projectDataService.clients.list()
  return <div className="px-3 py-2 space-y-2"><label className="sr-only" htmlFor="selected-project">Project</label><Select items={projects.map(item => ({ value: item.id, label: item.name }))} value={selectedId ?? null} onValueChange={value => { if (typeof value === 'string') report(projectDataService.select(value)) }}><SelectTrigger id="selected-project" aria-label="Selected project" className="w-full bg-background"><SelectValue className="truncate" placeholder="Choose a project" /></SelectTrigger><SelectContent>{projects.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" size="sm" onClick={() => { setName(project?.name ?? ''); setDescription(project?.description ?? ''); setDeleting(false); setOpen(true) }}>Manage projects</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Projects</DialogTitle><DialogDescription>Organize your tasks, meetings and notes by project.</DialogDescription></DialogHeader>
      <label className="text-sm">Project name<Input aria-label="Project name" value={name} onChange={event => setName(event.target.value)} maxLength={160} /></label><label className="text-sm">Description<Input aria-label="Project description" value={description} onChange={event => setDescription(event.target.value)} maxLength={5000} /></label>
      <div className="flex flex-wrap gap-2"><Button disabled={!name.trim()} onClick={() => { const result = projectDataService.create(name, description); if (result.ok) { projectDataService.select(result.value.id); setOpen(false) } else report(result) }}>Create project</Button><Button variant="outline" disabled={!project || !name.trim()} onClick={() => { if (project) report(projectDataService.projects.update(project.id, { name, description })) }}>Update selected project</Button><Button variant="destructive" disabled={selectedId === projectDataService.settings()?.defaultProjectId} onClick={() => setDeleting(true)}>Delete project</Button></div>
      {deleting && <div className="space-y-2 rounded border p-3"><p>Delete “{project?.name}”?</p><Button variant="destructive" onClick={() => { if (!selectedId) return; const result = projectDataService.delete(selectedId); report(result); if (result.ok) setOpen(false) }}>Confirm delete project</Button><Button variant="outline" onClick={() => setDeleting(false)}>Keep project</Button></div>}
      <h3 className="text-sm font-medium">Project clients</h3><RecordManager spec={clientSpec} />
      <select aria-label="Client to add" className="rounded border p-2" value={clientId} onChange={event => setClientId(event.target.value)}><option value="">Choose a client</option>{clients.filter(client => !active.some(link => link.clientId === client.id)).map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select><Button disabled={!selectedId || !clientId} onClick={() => { if (selectedId) { report(projectDataService.addClient(selectedId, clientId)); setClientId('') } }}>Add client to project</Button>
      {active.map(link => { const client = clients.find(client => client.id === link.clientId); return <div key={link.id} className="flex items-center justify-between gap-2 text-sm"><div>{client?.name}<p className="text-xs text-muted-foreground">{[client?.email, client?.phone].filter(Boolean).join(' · ')}</p></div><Button variant="ghost" size="sm" onClick={() => report(projectDataService.removeClient(link.projectId, link.clientId))}>Remove from project</Button></div> })}
    </DialogContent></Dialog>
  </div>
}
