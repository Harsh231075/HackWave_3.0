import { useState } from 'react'
import type { Task } from '@/domain/types'
import type { ActionOrigin } from '@/domain/workspaceActions'
import { focusSchedulingService, workspaceActionService } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function FocusScheduleDialog({ task, origin, initialDate, onClose, isCurrent = () => true }: { task: Task; origin: ActionOrigin; initialDate: string; onClose: () => void; isCurrent?: () => boolean }) {
  const { notify } = useWorkspace()
  const [date, setDate] = useState(initialDate)
  const [start, setStart] = useState('')
  const [error, setError] = useState('')
  const slots = focusSchedulingService.findSlots({ taskId: task.id, date, binding: origin.binding })
  const preview = slots.ok ? slots.value.find(s => s.start === start) : undefined
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}><DialogContent><DialogHeader><DialogTitle>Schedule focus</DialogTitle><DialogDescription>{task.title} · {task.duration} minutes</DialogDescription></DialogHeader><label className="text-sm">Date<input aria-label="Focus date" className="block rounded border p-2" type="date" value={date} min={origin.referenceDate} onChange={e => { setDate(e.target.value); setStart('') }} /></label>{slots.ok ? slots.value.length ? <label className="text-sm">Available time<select aria-label="Available focus time" className="block w-full rounded border p-2" value={start} onChange={e => setStart(e.target.value)}><option value="">Choose a slot</option>{slots.value.map(s => <option key={s.start} value={s.start}>{s.start}–{s.end}</option>)}</select></label> : <p>No available slots. Choose another date.</p> : <p role="alert">{slots.message}</p>}{preview && <p className="text-sm">{task.title} · {preview.date} · {preview.start}–{preview.end} · {task.duration} minutes</p>}{error && <p role="alert">{error}</p>}<Button disabled={!preview} onClick={() => {
    const checked = workspaceActionService.checkTask(origin, task)
    if (!isCurrent() || !checked.ok) { setError(!checked.ok ? checked.message : 'This view changed. Reopen scheduling.'); return }
    const result = focusSchedulingService.schedule({ taskId: task.id, date, start, binding: origin.binding, expectedDuration: task.duration })
    if (!result.ok) { setError(result.message); return }
    notify(`Focus saved: ${result.value.date} ${result.value.start}–${result.value.end}.`,'success'); onClose()
  }}>Confirm focus time</Button></DialogContent></Dialog>
}
