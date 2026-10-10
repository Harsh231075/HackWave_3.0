import { useState } from 'react'
import { useNavigate } from 'react-router'
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
  return <AppShell view="workspace" onNavigate={view => navigate(`/app${view === 'overview' ? '' : `?view=${view}`}`)}><div className="page-heading"><div><p className="eyebrow">DEVELOPMENT ONLY</p><h1>Component workshop.</h1><p>Inspect the shared widgets and their data states.</p></div></div><div className="gallery-controls"><label>Widget<select value={widget} onChange={event => setWidget(event.target.value as WidgetType)}>{widgetTypes.map(id => <option key={id} value={id}>{registry[id].title}</option>)}</select></label><label>Data state<select value={displayState} onChange={event => setDisplayState(event.target.value as DisplayState)}>{['ready', 'loading', 'empty', 'error'].map(state => <option key={state}>{state}</option>)}</select></label></div><WidgetFrame id={widget}><DataState state={displayState}><Preview /></DataState></WidgetFrame><section className="gallery-inventory"><h2>Reusable component inventory</h2><p>Forms open from task and calendar actions; explanation and toolbar controls appear in the workspace.</p><div>{inventory.map(name => <StatusBadge key={name} tone="success">{name}</StatusBadge>)}</div></section></AppShell>
}
