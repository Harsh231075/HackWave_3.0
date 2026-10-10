import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { ArrowRight, CalendarDays, ChevronDown, Clock3, Info, Layers, ListTodo, Plus, RotateCcw, Target, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/shell/AppShell'
import { AiCommandBar } from '@/components/shell/AiCommandBar'
import { TaskForm } from '@/components/tasks/TaskWidgets'
import { ExplanationPanel } from '@/components/resources/PreparationWidgets'
import { WorkspaceRenderer } from '@/lib/workspace/WorkspaceRenderer'
import { configFor, VIEWS, type View } from '@/lib/workspace/config'
import { registry, widgetTitle } from '@/lib/workspace/registry'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { ROLE_INFO } from '@/data/demo'
import type { Role } from '@/domain/types'

export function WorkspaceToolbar({ onUndoLayout, canUndoLayout, explanation, onExplain }: { onUndoLayout: () => void; canUndoLayout: boolean; explanation: boolean; onExplain: () => void }) {
  const { state, dispatch, notify } = useWorkspace()
  return <div className="flex justify-between items-center gap-4 bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0.65rem_1rem] mb-6 flex-wrap"><div className="flex items-center gap-3 text-[length:0.84rem]"><span className="text-[length:0.72rem] font-bold tracking-[0.08em] text-(--muted-foreground)">YOUR CONTEXT</span><label className="inline-flex items-center [gap:0.35rem] bg-(--muted) [border:1px_solid_var(--border)] [padding:0.25rem_0.65rem] rounded-[var(--radius)] font-medium [&_select]:bg-transparent [&_select]:border-0 [&_select]:outline-none [&_select]:text-[length:0.84rem] [&_select]:text-(--foreground) [&_select]:cursor-pointer"><span className="sr-only">Workspace context</span><select value={state.role} onChange={event => dispatch({ type: 'role', role: event.target.value as Role })}>{Object.entries(ROLE_INFO).map(([role, info]) => <option key={role} value={role}>{info.label}</option>)}</select><ChevronDown size={13} /></label><span className="[width:1px] h-4.5 bg-(--border)" /><span className="text-[length:0.8rem] text-(--muted-foreground)">{state.pins[state.role].length ? `${state.pins[state.role].length} pinned` : 'Pin what matters'}</span></div><div className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={!state.history.length} onClick={() => { dispatch({ type: 'undo' }); notify('Last local edit undone.') }}><Undo2 size={14} /> Undo edit</Button><Button size="sm" variant="ghost" disabled={!canUndoLayout} onClick={onUndoLayout}><RotateCcw size={14} /> Undo layout</Button><Button size="sm" variant={explanation ? 'secondary' : 'ghost'} aria-expanded={explanation} onClick={onExplain}><Info size={14} /> Why this view?</Button></div></div>
}
const modes = [
  { id: 'planning', label: 'Daily planning', icon: Clock3 }, { id: 'scheduling', label: 'Scheduling', icon: CalendarDays }, { id: 'recovery', label: 'Overdue recovery', icon: Target }, { id: 'preparation', label: 'Preparation', icon: ListTodo }, { id: 'usage', label: 'Usage investigation', icon: Layers },
]
export function AppPage() {
  const { state } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const rawView = params.get('view') ?? 'overview'
  const view: View = VIEWS.includes(rawView as View) ? rawView as View : 'overview'
  const mode = params.get('mode') ?? 'planning'
  const config = configFor(view, mode, state.role)
  const [layoutHistory, setLayoutHistory] = useState<string[]>([])
  const [explanation, setExplanation] = useState(false)
  const [create, setCreate] = useState(false)
  const changeLayout = (nextView: View, nextMode = mode) => {
    const next = new URLSearchParams()
    if (nextView !== 'overview') next.set('view', nextView)
    if (nextView === 'workspace') next.set('mode', nextMode)
    if (next.toString() === params.toString()) return
    setLayoutHistory(history => [...history, params.toString()].slice(-20)); setParams(next)
  }
  const undoLayout = () => { const previous = layoutHistory.at(-1); if (previous !== undefined) { setParams(previous); setLayoutHistory(history => history.slice(0, -1)) } }
  return <AppShell view={view} onNavigate={nextView => changeLayout(nextView)}><div className="flex justify-between items-end gap-6 mb-6 [&_.eyebrow]:text-[length:0.72rem] [&_.eyebrow]:font-bold [&_.eyebrow]:tracking-[0.08em] [&_.eyebrow]:text-(--primary) [&_.eyebrow]:[margin-bottom:0.3rem] [&_h1]:text-[length:1.85rem] [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:leading-[1.2] [&_p]:text-[length:0.94rem] [&_p]:text-(--muted-foreground) [&_p]:mt-1"><div><p className="eyebrow">{view === 'overview' ? `GOOD MORNING, ${ROLE_INFO[state.role].name.toUpperCase()}` : 'A SPACE FOR YOUR NEXT STEP'}</p><h1>{config.title}</h1><p>{config.description}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center [gap:0.45rem] text-[length:0.84rem] text-(--muted-foreground) bg-(--card) [border:1px_solid_var(--border)] [padding:0.45rem_0.9rem] rounded-[var(--radius)]"><CalendarDays size={15} /> October 12, 2026</span><Button onClick={() => setCreate(true)}><Plus size={15} /> New task</Button></div></div>{view === 'overview' && <div className="flex items-center justify-between gap-4 [background:linear-gradient(135deg,_rgba(99,_102,_241,_0.12)_0%,_rgba(168,_85,_247,_0.06)_100%),_var(--card)] [border:1px_solid_rgba(99,_102,_241,_0.25)] [padding:1.25rem_1.5rem] rounded-[var(--radius)] mb-6 [&_>_div]:flex [&_>_div]:items-center [&_>_div]:gap-4 [&_strong]:text-[length:1.05rem] [&_strong]:block [&_p]:text-[length:0.88rem] [&_p]:text-(--muted-foreground) [&_button]:inline-flex [&_button]:items-center [&_button]:[gap:0.45rem] [&_button]:text-[length:0.88rem] [&_button]:font-semibold [&_button]:[padding:0.65rem_1.25rem] [&_button]:bg-(--primary) [&_button]:text-white [&_button]:rounded-[var(--radius)] [&_button]:[transition:all_0.2s] [&_button]:shadow-[0_4px_12px_-2px_rgba(99,_102,_241,_0.3)] [&_button:hover]:[transform:translateX(2px)]"><div><span className="w-11 h-11 rounded-[var(--radius)] bg-(--primary) text-white inline-flex items-center justify-center shadow-[0_4px_12px_-2px_rgba(99,_102,_241,_0.4)]"><Target size={21} /></span><div><strong>A fresh week. A clearer starting point.</strong><p>Find your priorities and make a little time for them.</p></div></div><button onClick={() => changeLayout('workspace', 'planning')}>Plan my day <ArrowRight size={16} /></button></div>}{(view === 'overview' || view === 'workspace') && <AiCommandBar />}
    {view === 'workspace' && <section className="bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:1.15rem_1.25rem] mb-5 flex flex-col [gap:0.85rem] [&_p]:text-[length:0.84rem] [&_p]:text-(--muted-foreground)" aria-label="Static workspace presets"><div><span className="inline-flex items-center [gap:0.4rem] text-[length:0.75rem] font-bold tracking-[0.08em] text-(--primary)"><Layers size={14} /> STATIC COMPOSITIONS</span><p>Choose a preset to preview the same canvas in a different arrangement. This selector is not AI.</p></div><div className="flex [gap:0.55rem] flex-wrap [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:[padding:0.55rem_1rem] [&_button]:rounded-[var(--radius)] [&_button]:text-[length:0.85rem] [&_button]:font-medium [&_button]:bg-(--muted) [&_button]:[border:1px_solid_var(--border)] [&_button]:[transition:all_0.15s] [&_button:hover]:bg-(--surface-hover) [&_button.active]:bg-(--primary) [&_button.active]:text-white [&_button.active]:border-(--primary) [&_button.active]:shadow-[0_2px_8px_-1px_rgba(99,_102,_241,_0.4)]">{modes.map(item => <button key={item.id} className={config.id === item.id ? 'active' : ''} aria-pressed={config.id === item.id} onClick={() => changeLayout('workspace', item.id)}><item.icon size={15} />{item.id === 'preparation' ? state.role === 'student' ? 'Exam preparation' : state.role === 'teacher' ? 'Lesson preparation' : 'Meeting preparation' : item.label}</button>)}</div></section>}
    <WorkspaceToolbar onUndoLayout={undoLayout} canUndoLayout={layoutHistory.length > 0} explanation={explanation} onExplain={() => setExplanation(!explanation)} />
    {explanation && <ExplanationPanel title={config.title} widgets={config.widgets.map(widget => ({ title: widgetTitle(widget.id, state.role), reason: registry[widget.id].reason }))} />}
    <WorkspaceRenderer config={config} /><TaskForm key={`new-${create}-${state.role}`} open={create} onClose={() => setCreate(false)} />
  </AppShell>
}
