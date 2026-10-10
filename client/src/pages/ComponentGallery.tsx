import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { DataState, StatusBadge, type DisplayState } from '@/components/feedback/common'
import { widgetTypes, type WidgetType } from '@/lib/workspace/config'
import { registry } from '@/lib/workspace/registry'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'

const inventory = ['MetricCard', 'TaskCard', 'TaskList', 'PriorityBoard', 'TaskForm', 'CalendarView', 'MeetingCard', 'MeetingForm', 'AvailabilityPanel', 'DailyTimeline', 'TimeBlockCard', 'RecommendationCard', 'ConfirmationDialog', 'ExplanationPanel', 'FilterControls', 'WorkspaceToolbar', 'ProductivityChart', 'WorkspaceRenderer', 'ResourceList', 'EditableOutline', 'ContextSummary', 'EvidenceLinks']
export function ComponentGallery() {
  const navigate = useNavigate()
  const [widget, setWidget] = useState<WidgetType>('tasks')
  const [displayState, setDisplayState] = useState<DisplayState>('ready')
  const Preview = registry[widget].component
  return <AppShell view="workspace" onNavigate={view => navigate(`/app${view === 'overview' ? '' : `/${view}`}`)}><div className="flex justify-between items-end gap-6 mb-6 [&_.eyebrow]:text-[length:0.72rem] [&_.eyebrow]:font-bold [&_.eyebrow]:tracking-[0.08em] [&_.eyebrow]:text-(--primary) [&_.eyebrow]:[margin-bottom:0.3rem] [&_h1]:text-[length:1.85rem] [&_h1]:font-bold [&_h1]:tracking-[-0.02em] [&_h1]:leading-[1.2] [&_p]:text-[length:0.94rem] [&_p]:text-(--muted-foreground) [&_p]:mt-1"><div><p className="eyebrow">DEVELOPMENT ONLY</p><h1>Component workshop.</h1><p>Inspect the shared widgets and their data states.</p></div></div><div className="flex gap-5 mb-6 [&_label]:flex [&_label]:flex-col [&_label]:[gap:0.35rem] [&_label]:text-[length:0.84rem] [&_label]:font-medium [&_select]:bg-(--card) [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-[var(--radius)] [&_select]:[padding:0.45rem_0.85rem] [&_select]:text-[length:0.88rem] [&_select]:text-(--foreground)"><label>Widget<select value={widget} onChange={event => setWidget(event.target.value as WidgetType)}>{widgetTypes.map(id => <option key={id} value={id}>{registry[id].title}</option>)}</select></label><label>Data state<select value={displayState} onChange={event => setDisplayState(event.target.value as DisplayState)}>{['ready', 'loading', 'empty', 'error'].map(state => <option key={state}>{state}</option>)}</select></label></div><WidgetFrame id={widget}><DataState state={displayState}><Preview /></DataState></WidgetFrame><section className="mt-8 bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] p-5 [&_h2]:text-[length:1.1rem] [&_h2]:font-semibold [&_h2]:mb-1 [&_p]:text-[length:0.84rem] [&_p]:text-(--muted-foreground) [&_p]:mb-4 [&_div]:flex [&_div]:gap-2 [&_div]:flex-wrap"><h2>Reusable component inventory</h2><p>Forms open from task and calendar actions; explanation and toolbar controls appear in the workspace.</p><div>{inventory.map(name => <StatusBadge key={name} tone="success">{name}</StatusBadge>)}</div></section></AppShell>
}
