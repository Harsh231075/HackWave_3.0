import { draftService, noteService, projectDataService } from '@/services'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { AttachmentManager } from './AttachmentManager'
import { RecordManager } from '@/components/records/RecordManager'
import { resourceSpec, clientSpec, projectSpec } from '@/components/records/recordSpecs'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useComponentView } from '@/state/ComponentViewContext'
import { DraftEditor } from './DraftEditor'
import { useUsageScope } from '@/state/UsageScopeContext'
import { UsageSummary } from '@/components/insights/UsageWorkspaceWidgets'
import { usageDraftKey } from '@/domain/usageComposition'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { OverdueSummary } from '@/components/tasks/OverdueWidgets'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { MeetingSummary } from './MeetingPreparationWidgets'
import { useEffect, useState } from 'react'
import { ArrowUpRight, BookOpen, Check, FileText, Link2, Sparkles, Target } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DataState, type DisplayState } from '@/components/feedback/common'
import { resourceService, fileService } from '@/services'
import type { Resource } from '@/domain/types'

export function EvidenceLinks({ resource, onOpen }: { resource: Resource; onOpen: () => void }) { return <button className="inline-flex items-center [gap:0.35rem] text-[length:0.76rem] text-(--primary) mt-1" onClick={onOpen}><Link2 size={13} /> {resource.title}<ArrowUpRight size={12} /></button> }
export function ResourceList({ displayState }: { displayState?: DisplayState }) {
  const [selected, setSelected] = useState<Resource>()
  const usage = useUsageScope()
  const scope = useMeetingScope()
  const overdue = useOverdueScope()
  const component = useComponentView()
  const resources = usage ? usage.data.snapshot.resources : overdue ? overdue.data.resources : scope ? scope.data.resources : component?.resources ?? resourceService.list()
  return <><div className="mb-3 flex flex-wrap gap-2"><AttachmentManager/><RecordManager spec={resourceSpec} filter={r=>resources.some(item=>item.id===r.id)} /></div><DataState state={displayState ?? (resources.length ? 'ready' : 'empty')}><div className="flex flex-col [gap:0.65rem]">{resources.map(resource => <article key={resource.id} className="flex items-center [gap:0.85rem] [padding:0.75rem_0.9rem] bg-(--background) [border:1px_solid_var(--border)] rounded-[var(--radius)] [&_div]:flex-1 [&_div]:flex [&_div]:flex-col [&_button]:text-left [&_button]:font-semibold [&_button]:text-[length:0.88rem] [&_small]:text-[length:0.76rem] [&_small]:text-(--muted-foreground)"><span className="text-(--primary)"><FileText size={19} /></span><div><button onClick={() => setSelected(resource)}>{resource.title}</button><small>{resource.kind} · {resource.context}</small><EvidenceLinks resource={resource} onOpen={() => setSelected(resource)} /></div></article>)}</div></DataState><Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(undefined) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.kind} · local resource</DialogDescription></DialogHeader><p className="text-[length:0.88rem] leading-[1.6] text-(--foreground) bg-(--muted) p-4 rounded-[var(--radius)] [border:1px_solid_var(--border)]">{selected?.body}</p>{selected?.kind==='attachment'&&selected.body.startsWith('file:')&&<Button onClick={()=>{const url=fileService.getDownloadUrl(selected.body.slice(5));if(!url)return;const a=document.createElement('a');a.href=url;a.download=selected.title;a.click();setTimeout(()=>fileService.revokeDownloadUrl(url),1000)}}>Download attachment</Button>}<p className="text-[length:0.78rem] text-(--muted-foreground)">This content is stored locally; it is not a live cloud document.</p></DialogContent></Dialog></>
}
export function EditableOutline() {
  const usage = useUsageScope()
  const scope = useMeetingScope()
  const component = useComponentView()
  const key = usage ? usageDraftKey(usage.intent) : scope ? `meeting-agenda:${scope.data.meeting.id}` : component?.plan.bindings.draftKey ?? `project-outline:${component?.plan.bindings.projectId ?? projectDataService.selectedId()}`
  const projectId = scope?.data.project.id ?? usage?.intent.projectId ?? component?.plan.bindings.projectId ?? projectDataService.selectedId()
  if (projectId && (scope || usage?.intent.projectId)) return <FocusedNotes projectId={projectId} draftKey={key} fallback={scope?.data.meeting.agenda ?? ''}/>
  if (projectId && !usage && !scope && !component?.plan.bindings.draftKey?.startsWith('google-preparation:')) return <NotesPanel key={projectId} projectId={projectId}/>
  return <><DraftEditor draftKey={key} label={usage ? 'Investigation notes' : scope ? 'Meeting agenda' : 'Preparation outline'} fallback={scope?.data.meeting.agenda ?? ''} /></>
}
function FocusedNotes({ projectId, draftKey, fallback }: { projectId: string; draftKey: string; fallback: string }) {
  const { notify } = useWorkspace()
  useEffect(() => {
    if (!noteService.list(projectId).some(note => note.draftKey === draftKey)) {
      const result = draftService.save(draftKey, draftService.get(draftKey) ?? fallback)
      if (!result.ok) notify(result.message)
    }
  }, [projectId, draftKey, fallback, notify])
  return <NotesPanel projectId={projectId} focusedDraftKey={draftKey}/>
}
export function ContextSummary() {
  const overdue = useOverdueScope()
  const usage = useUsageScope()
  const scope = useMeetingScope()
  const component = useComponentView()
  if (usage) return <><RecordManager spec={projectSpec} filter={r=>r.id===usage.intent.projectId||!usage.intent.projectId&&r.clientId===usage.intent.clientId}/><UsageSummary /></>
  if (overdue) return <><RecordManager spec={projectSpec} filter={r=>r.id===overdue.data.project.id}/><OverdueSummary /></>
  if (scope) return <><RecordManager spec={projectSpec} filter={r=>r.id===scope.data.project.id}/><MeetingSummary /></>
  const info = { context: component?.projects.length === 1 ? component.projects[0].name : 'Your workspace', subtitle: 'Keep your projects, materials, and next steps together.', label: 'Shared' }
  const selectedResources=component?.resources??resourceService.list()
  const contexts = [...new Set(selectedResources.map(resource => resource.context))]
  return <div className="flex flex-col [gap:0.85rem] [&_h3]:text-[length:1.25rem] [&_h3]:font-bold [&_p]:text-[length:0.88rem] [&_p]:text-(--muted-foreground) [&_dl]:grid [&_dl]:grid-cols-3 [&_dl]:[gap:0.65rem] [&_dl]:bg-(--muted) [&_dl]:[border:1px_solid_var(--border)] [&_dl]:p-3 [&_dl]:rounded-[var(--radius)] [&_dt]:text-[length:0.72rem] [&_dt]:text-(--muted-foreground) [&_dd]:text-[length:1.1rem] [&_dd]:font-bold"><div className="w-12 h-12 rounded-[var(--radius)] bg-(--accent) text-(--primary) inline-flex items-center justify-center"><BookOpen size={23} /></div><div className="flex flex-wrap gap-2"><RecordManager spec={clientSpec}/><RecordManager spec={projectSpec}/></div><h3>{info.context}</h3><p>{info.subtitle}</p><dl><div><dt>Current context</dt><dd>{info.label}</dd></div><div><dt>Projects / topics</dt><dd>{contexts.length}</dd></div><div><dt>Linked resources</dt><dd>{selectedResources.length}</dd></div></dl><div className="flex [gap:0.45rem] flex-wrap [&_span]:text-[length:0.76rem] [&_span]:[padding:0.25rem_0.6rem] [&_span]:bg-(--background) [&_span]:[border:1px_solid_var(--border)] [&_span]:rounded-full [&_span]:text-(--muted-foreground)">{contexts.map(context => <span key={context}>{context}</span>)}</div></div>
}
export function ExplanationPanel({ title, widgets }: { title: string; widgets: Array<{ title: string; reason: string }> }) {
  return <div className="bg-accent/50 [border:1px_solid_rgba(69,_106,_82,_0.25)] rounded-[var(--radius)] [padding:1.25rem_1.5rem] mb-6 flex flex-col [gap:0.85rem] [&_>_p]:text-[length:0.88rem] [&_>_p]:text-(--muted-foreground) [&_ul]:grid [&_ul]:[grid-template-columns:repeat(auto-fit,_minmax(280px,_1fr))] [&_ul]:gap-3 [&_ul]:list-none [&_li]:flex [&_li]:[gap:0.65rem] [&_li]:bg-(--card) [&_li]:[border:1px_solid_var(--border)] [&_li]:[padding:0.75rem_1rem] [&_li]:rounded-[var(--radius)] [&_li]:text-[length:0.85rem] [&_li_svg]:text-(--primary) [&_li_svg]:shrink-0 [&_li_svg]:[margin-top:0.15rem] [&_li_p]:text-[length:0.8rem] [&_li_p]:text-(--muted-foreground) [&_li_p]:[margin-top:0.2rem]"><div className="flex items-center gap-3 text-(--primary) [&_h3]:text-[length:1.05rem] [&_h3]:font-semibold [&_h3]:text-(--foreground) [&_p]:text-[length:0.8rem] [&_p]:text-(--muted-foreground)"><Sparkles size={18} /><div><h3>Why this workspace?</h3><p>Static preview · {title}</p></div></div><p>The selected preset changes what takes priority. Your edits, context, and pinned widgets stay with you.</p><ul>{widgets.map(widget => <li key={widget.title}><Target size={14} /><div><strong>{widget.title}</strong><p>{widget.reason}</p></div></li>)}</ul><div className="inline-flex items-center [gap:0.4rem] text-[length:0.78rem] text-(--muted-foreground) [padding-top:0.4rem] [border-top:1px_solid_var(--border)]"><Check size={14} /> You control record changes through the component’s forms and buttons.</div></div>
}
