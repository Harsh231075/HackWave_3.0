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
  return <div className="workspace-toolbar"><div className="toolbar-context"><span className="toolbar-label">YOUR CONTEXT</span><label className="context-select"><span className="sr-only">Workspace context</span><select value={state.role} onChange={event => dispatch({ type: 'role', role: event.target.value as Role })}>{Object.entries(ROLE_INFO).map(([role, info]) => <option key={role} value={role}>{info.label}</option>)}</select><ChevronDown size={13} /></label><span className="toolbar-divider" /><span className="toolbar-pin-count">{state.pins[state.role].length ? `${state.pins[state.role].length} pinned` : 'Pin what matters'}</span></div><div className="toolbar-actions"><Button size="sm" variant="ghost" disabled={!state.history.length} onClick={() => { dispatch({ type: 'undo' }); notify('Last local edit undone.') }}><Undo2 size={14} /> Undo edit</Button><Button size="sm" variant="ghost" disabled={!canUndoLayout} onClick={onUndoLayout}><RotateCcw size={14} /> Undo layout</Button><Button size="sm" variant={explanation ? 'secondary' : 'ghost'} aria-expanded={explanation} onClick={onExplain}><Info size={14} /> Why this view?</Button></div></div>
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
  return <AppShell view={view} onNavigate={nextView => changeLayout(nextView)}><div className="page-heading"><div><p className="eyebrow">{view === 'overview' ? `GOOD MORNING, ${ROLE_INFO[state.role].name.toUpperCase()}` : 'A SPACE FOR YOUR NEXT STEP'}</p><h1>{config.title}</h1><p>{config.description}</p></div><div className="page-heading-actions"><span className="date-pill"><CalendarDays size={15} /> October 12, 2026</span><Button onClick={() => setCreate(true)}><Plus size={15} /> New task</Button></div></div>{view === 'overview' && <div className="welcome-banner"><div><span className="welcome-icon"><Target size={21} /></span><div><strong>A fresh week. A clearer starting point.</strong><p>Find your priorities and make a little time for them.</p></div></div><button onClick={() => changeLayout('workspace', 'planning')}>Plan my day <ArrowRight size={16} /></button></div>}{(view === 'overview' || view === 'workspace') && <AiCommandBar />}
    {view === 'workspace' && <section className="preview-picker" aria-label="Static workspace presets"><div><span className="preview-label"><Layers size={14} /> STATIC COMPOSITIONS</span><p>Choose a preset to preview the same canvas in a different arrangement. This selector is not AI.</p></div><div className="preset-buttons">{modes.map(item => <button key={item.id} className={config.id === item.id ? 'active' : ''} aria-pressed={config.id === item.id} onClick={() => changeLayout('workspace', item.id)}><item.icon size={15} />{item.id === 'preparation' ? state.role === 'student' ? 'Exam preparation' : state.role === 'teacher' ? 'Lesson preparation' : 'Meeting preparation' : item.label}</button>)}</div></section>}
    <WorkspaceToolbar onUndoLayout={undoLayout} canUndoLayout={layoutHistory.length > 0} explanation={explanation} onExplain={() => setExplanation(!explanation)} />
    {explanation && <ExplanationPanel title={config.title} widgets={config.widgets.map(widget => ({ title: widgetTitle(widget.id, state.role), reason: registry[widget.id].reason }))} />}
    <WorkspaceRenderer config={config} /><TaskForm key={`new-${create}-${state.role}`} open={create} onClose={() => setCreate(false)} />
  </AppShell>
}
