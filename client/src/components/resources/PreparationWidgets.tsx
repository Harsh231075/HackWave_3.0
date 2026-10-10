import { useState } from 'react'
import { ArrowUpRight, BookOpen, Check, FileText, Link2, Save, Sparkles, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, SaveFeedback, type DisplayState } from '@/components/feedback/common'
import { RESOURCES, ROLE_INFO } from '@/data/demo'
import { useWorkspace } from '@/state/WorkspaceProvider'
import type { Resource } from '@/domain/types'

export function EvidenceLinks({ resource, onOpen }: { resource: Resource; onOpen: () => void }) { return <button className="evidence-link" onClick={onOpen}><Link2 size={13} /> {resource.title}<ArrowUpRight size={12} /></button> }
export function ResourceList({ displayState }: { displayState?: DisplayState }) {
  const { state } = useWorkspace()
  const [selected, setSelected] = useState<Resource>()
  const resources = RESOURCES.filter(resource => resource.role === state.role)
  return <><DataState state={displayState ?? 'ready'}><div className="resource-list">{resources.map(resource => <article key={resource.id} className="resource-card"><span className="resource-icon"><FileText size={19} /></span><div><button onClick={() => setSelected(resource)}>{resource.title}</button><small>{resource.kind} · {resource.context}</small><EvidenceLinks resource={resource} onOpen={() => setSelected(resource)} /></div></article>)}</div></DataState><Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(undefined) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{selected?.title}</DialogTitle><DialogDescription>{selected?.kind} · synthetic demo source</DialogDescription></DialogHeader><p className="source-body">{selected?.body}</p><p className="subtle-label">This source is part of the deterministic demo dataset, not a live integration.</p></DialogContent></Dialog></>
}
export function EditableOutline() {
  const { state, draftBuffers, editDraft, dispatch, notify } = useWorkspace()
  const key = `${state.role}:outline`
  const value = draftBuffers[key] ?? state.drafts[key] ?? ''
  const dirty = value !== state.drafts[key]
  const [saved, setSaved] = useState(false)
  const label = state.role === 'student' ? 'Study outline' : state.role === 'teacher' ? 'Lesson outline' : 'Meeting agenda'
  return <div className="editable-outline"><div className="outline-note"><FileText size={16} /><span>{label} · your editable draft</span></div><label className="sr-only" htmlFor={`outline-${state.role}`}>{label}</label><Textarea id={`outline-${state.role}`} value={value} onChange={event => { editDraft(key, event.target.value); setSaved(false) }} rows={7} maxLength={5000} placeholder="Add your plan, talking points, or next steps…" /><div className="outline-footer"><span className="subtle-label">{dirty ? 'Unsaved draft · kept while switching views' : 'Saved draft · session only'}</span><Button size="sm" disabled={!dirty} onClick={() => { dispatch({ type: 'draft', key, value }); setSaved(true); notify(`${label} saved for this session.`) }}><Save size={14} /> Save draft</Button></div><SaveFeedback saved={saved && !dirty} /></div>
}
export function ContextSummary() {
  const { state } = useWorkspace()
  const info = ROLE_INFO[state.role]
  const contexts = [...new Set(state.tasks.filter(task => task.role === state.role).map(task => task.context))]
  return <div className="context-summary"><div className="context-emblem"><BookOpen size={23} /></div><h3>{info.context}</h3><p>{info.subtitle}</p><dl><div><dt>Current context</dt><dd>{info.label}</dd></div><div><dt>Projects / courses</dt><dd>{contexts.length}</dd></div><div><dt>Linked resources</dt><dd>{RESOURCES.filter(resource => resource.role === state.role).length}</dd></div></dl><div className="context-tags">{contexts.map(context => <span key={context}>{context}</span>)}</div></div>
}
export function ExplanationPanel({ title, widgets }: { title: string; widgets: Array<{ title: string; reason: string }> }) {
  return <div className="explanation-panel"><div className="explanation-heading"><Sparkles size={18} /><div><h3>Why this workspace?</h3><p>Static preview · {title}</p></div></div><p>The selected preset changes what takes priority. Your edits, context, and pinned widgets stay with you.</p><ul>{widgets.map(widget => <li key={widget.title}><Target size={14} /><div><strong>{widget.title}</strong><p>{widget.reason}</p></div></li>)}</ul><div className="explanation-footnote"><Check size={14} /> No AI is connected in this prototype.</div></div>
}
