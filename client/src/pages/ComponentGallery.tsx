import { PinControlsContext } from '@/lib/workspace/WidgetSelectionContext'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { AppShell } from '@/components/shell/AppShell'
import { DataState, type DisplayState } from '@/components/feedback/common'
import { type WidgetType } from '@/lib/workspace/config'
import { registry, activeRegistry } from '@/lib/workspace/registry'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'

export function ComponentGallery() {
  const navigate = useNavigate()
  const [widget, setWidget] = useState<WidgetType>('tasks')
  const [displayState, setDisplayState] = useState<DisplayState>('ready')
  const Preview = registry[widget].component
  return <AppShell view="workspace" onNavigate={() => navigate('/')}><PageHeaderActions><div className="flex flex-wrap gap-3 [&_label]:flex [&_label]:flex-col [&_label]:[gap:0.35rem] [&_label]:text-[length:0.84rem] [&_label]:font-medium [&_select]:bg-(--card) [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-[var(--radius)] [&_select]:[padding:0.45rem_0.85rem] [&_select]:text-[length:0.88rem] [&_select]:text-(--foreground)"><label>Widget<select value={widget} onChange={event => setWidget(event.target.value as WidgetType)}>{(Object.keys(activeRegistry()) as WidgetType[]).map(id => <option key={id} value={id}>{registry[id].title}</option>)}</select></label><label>Data state<select value={displayState} onChange={event => setDisplayState(event.target.value as DisplayState)}>{['ready', 'loading', 'empty', 'error'].map(state => <option key={state}>{state}</option>)}</select></label></div></PageHeaderActions><PinControlsContext.Provider value={false}><WidgetFrame id={widget}><DataState state={displayState}><Preview /></DataState></WidgetFrame></PinControlsContext.Provider></AppShell>
}
