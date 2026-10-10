import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { focusSchedulingService } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { TaskForm } from './TaskWidgets'
import type { Task } from '@/domain/types'
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
  const { notify } = useWorkspace()
  const [selectedId, setSelectedId] = useState('')
  const [task, setTask] = useState<Task | null>(null)
  const [editing, setEditing] = useState<Task | undefined>()
  const [date, setDate] = useState(scope?.data.referenceDate ?? '')
  const [start, setStart] = useState('')
  const [error, setError] = useState('')
  if (!scope) return null
  const slots = task ? focusSchedulingService.findSlots({ taskId: task.id, date, intent: scope.intent }) : null
  const selected = scope.tasks.find(t => t.id === selectedId) ?? scope.tasks[0]
  const preview = slots?.ok ? slots.value.find(s => s.start === start) : undefined
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{scope.tasks.filter(t => t.status === 'blocked').length} blocked · resolve blockers before scheduling.</p>{selected && <div className="space-y-3"><label className="block text-sm">Recovery task<select aria-label="Recovery task" className="mt-1 block w-full rounded border p-2" value={selected.id} onChange={e => setSelectedId(e.target.value)}>{scope.tasks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => setEditing(selected)}>Edit task</Button><Button size="sm" disabled={selected.status !== 'pending'} onClick={() => { setTask(selected); setStart(''); setError('') }}>Schedule focus</Button></div></div>}{!scope.tasks.length && <p className="text-sm">No overdue work matches this review.</p>}<TaskForm key={editing?.id ?? 'closed'} task={editing} open={!!editing} onClose={() => setEditing(undefined)} /><Dialog open={!!task} onOpenChange={open => { if (!open) setTask(null) }}><DialogContent><DialogHeader><DialogTitle>Schedule focus</DialogTitle><DialogDescription>{task?.title} · {task?.duration} minutes</DialogDescription></DialogHeader><label className="text-sm">Date<input aria-label="Focus date" className="block rounded border p-2" type="date" value={date} min={scope.data.referenceDate} onChange={e => { setDate(e.target.value); setStart('') }} /></label>{slots?.ok ? slots.value.length ? <label className="text-sm">Available time<select aria-label="Available focus time" className="block w-full rounded border p-2" value={start} onChange={e => setStart(e.target.value)}><option value="">Choose a slot</option>{slots.value.map(s => <option key={s.start} value={s.start}>{s.start}–{s.end}</option>)}</select></label> : <p>No available slots. Choose another date.</p> : <p role="alert">{slots && !slots.ok ? slots.message : ''}</p>}{preview && <p className="text-sm">{task?.title} · {preview.date} · {preview.start}–{preview.end} · {task?.duration} minutes</p>}{error && <p role="alert">{error}</p>}<Button disabled={!preview} onClick={() => {
    if (!task || !preview) return
    const result = focusSchedulingService.schedule({ taskId: task.id, date, start, intent: scope.intent, expectedDuration: task.duration })
    if (!result.ok) { setError(result.message); return }
    notify(`Focus saved: ${result.value.date} ${result.value.start}–${result.value.end}.`); setTask(null)
  }}>Confirm focus time</Button></DialogContent></Dialog></div>
}
