import { useWorkspaceActions } from '@/lib/workspace/WorkspaceActionContext'
import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { Button } from '@/components/ui/button'
import { overdueEvidenceRecords } from '@/domain/overdueReview'
export function OverdueSummary() {
  const scope = useOverdueScope()
  if (!scope) return null
  return <div className="space-y-3"><h3 className="text-xl font-semibold">{scope.data.project.name}</h3><p className="text-sm text-muted-foreground">{scope.data.client?.name} · Overdue before {format(parseISO(scope.data.referenceDate), 'd MMM')}</p><p className="text-sm">{scope.tasks.length} matching tasks · {scope.tasks.reduce((sum,t) => sum + t.duration, 0)} minutes remaining</p></div>
}
export function OverdueEvidence({ widgetId }: { widgetId: string }) {
  const scope = useOverdueScope()
  const widget = scope?.composition.widgets.find(w => w.type === widgetId)
  if (!scope || !widget) return <p>Explicitly linked project records.</p>
  const records = overdueEvidenceRecords(scope.data)
  return <div className="space-y-2"><p>{widget.reason}</p>{widget.evidence.map(ref => { const item = records.find(r => r.kind === ref.kind && r.record.id === ref.id); return <details key={`${ref.kind}:${ref.id}`}><summary className="cursor-pointer">{ref.kind} · {ref.id}{!item && ' · unavailable'}</summary><pre className="whitespace-pre-wrap break-words text-xs">{item ? JSON.stringify(item.record, null, 2) : 'Source is no longer available.'}</pre></details> })}</div>
}
export function OverdueRecovery() {
  const scope = useOverdueScope()
  const actions = useWorkspaceActions()
  const [selectedId, setSelectedId] = useState('')
  if (!scope) return null
  const selected = scope.tasks.find(t => t.id === selectedId) ?? scope.tasks[0]
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{scope.tasks.filter(t => t.status === 'blocked').length} blocked · resolve blockers before scheduling.</p>{selected && <div className="space-y-3"><label className="block text-sm">Recovery task<select aria-label="Recovery task" className="mt-1 block w-full rounded border p-2" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{scope.tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!actions || actions.pending} onClick={() => actions?.dispatch({ type: 'task.edit', taskId: selected.id })}>Edit task</Button><Button size="sm" disabled={!actions || actions.pending || selected.status !== 'pending'} onClick={() => actions?.dispatch({ type: 'focus.schedule', taskId: selected.id })}>Schedule focus</Button></div></div>}{!scope.tasks.length && <p className="text-sm">No overdue work matches this review.</p>}</div>
}
