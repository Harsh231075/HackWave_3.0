import { useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AppShell } from '@/components/shell/AppShell'
import { WorkspaceRenderer } from '@/lib/workspace/WorkspaceRenderer'
import { configFor, VIEWS, type View } from '@/lib/workspace/config'
import { useWorkspace } from '@/state/WorkspaceProvider'

const modes = [
  { id: 'planning', label: 'Planning' }, { id: 'scheduling', label: 'Scheduling' },
  { id: 'recovery', label: 'Recovery' }, { id: 'preparation', label: 'Preparation' },
  { id: 'usage', label: 'Usage' },
]
const titles: Record<View, string> = { overview: 'Overview', tasks: 'Tasks', calendar: 'Calendar', meetings: 'Meetings', planner: 'Planner', priorities: 'Priorities', insights: 'Insights', workspace: 'Workspace' }

export function AppPage() {
  const { state, dispatch } = useWorkspace()
  const params = useParams<{ view: string; mode: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const rawView = params.view ?? 'overview'
  const view = rawView as View
  const mode = params.mode ?? 'planning'
  const [layoutHistory, setLayoutHistory] = useState<string[]>([])
  if (!VIEWS.includes(view) || (params.mode && (view !== 'workspace' || !modes.some(item => item.id === mode)))) return <Navigate to="/app" replace />
  const config = configFor(view, mode)
  const changeLayout = (nextView: View, nextMode = mode) => {
    const next = nextView === 'overview' ? '/app' : nextView === 'workspace' ? `/app/workspace/${nextMode}` : `/app/${nextView}`
    if (next === location.pathname) return
    setLayoutHistory(history => [...history, location.pathname].slice(-20))
    navigate(next)
  }
  return <AppShell view={view} onNavigate={changeLayout}>
    <header className="minimal-page-heading"><h1>{titles[view]}</h1><div className="minimal-page-actions">
      {view === 'workspace' && <select aria-label="Workspace layout" value={mode} onChange={event => changeLayout('workspace', event.target.value)}>{modes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}
      {layoutHistory.length > 0 && <Button variant="ghost" size="sm" onClick={() => { navigate(layoutHistory.at(-1)!); setLayoutHistory(history => history.slice(0, -1)) }}>Undo layout</Button>}
      {state.history.length > 0 && <Button variant="ghost" size="icon-sm" aria-label="Undo last edit" title="Undo last edit" onClick={() => dispatch({ type: 'undo' })}><Undo2 size={16} /></Button>}
    </div></header>
    <WorkspaceRenderer config={config} />
  </AppShell>
}
