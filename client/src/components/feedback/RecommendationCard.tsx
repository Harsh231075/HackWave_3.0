import { useWorkspaceActions } from '@/lib/workspace/WorkspaceActionContext'
import { useComponentView } from '@/state/ComponentViewContext'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { OverdueRecovery } from '@/components/tasks/OverdueWidgets'
import { Button } from '@/components/ui/button'
import { DataState } from './common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'

export function RecommendationCard() {
  const scope = useOverdueScope()
  return scope ? <OverdueRecovery /> : <GeneralRecommendationCard />
}
function GeneralRecommendationCard() {
  const { state, selectedDate, dismissRecommendation } = useWorkspace()
  const actions = useWorkspaceActions()
  const component = useComponentView()
  const today = component?.plan.referenceDate ?? DEMO_DATE
  const task = state.tasks.filter(task => task.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due))[0]
  if (!task) return <DataState state="empty" empty="All caught up. There’s no outstanding work to recommend."><span /></DataState>
  const id = `recommendation-${task.id}`
  if (state.dismissed.includes(id)) return <p className="text-sm text-muted-foreground">Recommendation dismissed. Use Undo edit to restore it.</p>
  return <div className="space-y-3 rounded-lg bg-accent/50 p-4">
    <h3 className="font-medium">Make space for {task.title.toLowerCase()}.</h3>
    <p className="text-sm text-muted-foreground">{task.due < today ? `Overdue since ${task.due}.` : `Due ${task.due}.`} Estimated work: {task.duration} minutes.</p>
    <p className="text-xs text-muted-foreground">Choose an available slot and confirm a local focus block. Google Calendar is unchanged.</p>
    <div className="flex gap-2"><Button size="sm" disabled={!actions || actions.pending || task.status !== 'pending'} onClick={() => actions?.dispatch({ type: 'focus.schedule', taskId: task.id, date: selectedDate })}>Schedule focus</Button><Button size="sm" variant="ghost" onClick={() => dismissRecommendation(id)}>Dismiss</Button></div>
    {task.status === 'blocked' && <p className="text-xs text-muted-foreground">Resolve the blocker before scheduling focus.</p>}
  </div>
}
export function RecentActivity() {
  const { state } = useWorkspace()
  return <div className="flex flex-col [gap:0.65rem]">{state.activity.slice(0, 5).map((item, index) => <div className="flex [gap:0.65rem] text-[length:0.85rem] [&_small]:text-[length:0.74rem] [&_small]:text-(--muted-foreground)" key={`${item}-${index}`}><span className="[width:7px] [height:7px] rounded-full bg-(--primary) [margin-top:0.4rem]" /><div><p>{item}</p><small>{index === 0 && state.history.length ? 'Just now · local change' : 'Demo session'}</small></div></div>)}</div>
}
