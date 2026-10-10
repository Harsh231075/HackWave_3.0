import { useOverdueScope } from '@/state/OverdueScopeContext'
import { OverdueRecovery } from '@/components/tasks/OverdueWidgets'
import { activityService } from '@/services'
import { useState } from 'react'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog, DataState } from './common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { eventError } from '@/domain/workspace'
import type { Event } from '@/domain/types'

export function RecommendationCard() {
  const scope = useOverdueScope()
  return scope ? <OverdueRecovery /> : <GeneralRecommendationCard />
}
function GeneralRecommendationCard() {
  const { state, addFocusTime, dismissRecommendation, notify } = useWorkspace()
  const [confirm, setConfirm] = useState(false)
  const task = state.tasks.filter(task => task.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due))[0]
  if (!task) return <DataState state="empty" empty="All caught up. There’s no outstanding work to recommend."><span /></DataState>
  const id = `recommendation-${task.id}`
  const event: Event = { id, title: `Focus: ${task.title}`, date: DEMO_DATE, start: '13:30', end: '14:30', category: 'focus', participants: [], agenda: `Work on ${task.title}.` }
  const accepted = state.events.some(item => item.id === id)
  const conflict = eventError(event, state.events)
  if (state.dismissed.includes(id)) return <div className="flex flex-col items-center justify-center gap-2 [padding:2.5rem_1rem] text-center text-(--muted-foreground) text-[length:0.88rem]"><CheckCircle2 size={22} /><p>Recommendation dismissed.</p><small>Use Undo edit to bring it back.</small></div>
  return <div className="bg-accent/50 [border:1px_solid_rgba(69,_106,_82,_0.25)] rounded-[var(--radius)] [padding:1.15rem] flex flex-col [gap:0.65rem] [&_h3]:text-[length:1.05rem] [&_h3]:font-semibold [&_p]:text-[length:0.88rem] [&_p]:text-(--muted-foreground)"><div className="inline-flex items-center [gap:0.4rem] text-[length:0.76rem] font-semibold text-(--primary) [&_span]:text-[length:0.7rem] [&_span]:text-(--muted-foreground) [&_span]:font-normal"><Sparkles size={14} /> A thoughtful next step <span>Static example</span></div><h3>Make a little space for your priority.</h3><p>Reserve a focus session for <strong>{task.title.toLowerCase()}</strong>.</p><div className="bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0.65rem_0.85rem] text-[length:0.82rem] [&_span]:font-semibold [&_span]:block [&_span]:text-[length:0.74rem] [&_span]:text-(--primary) [&_span]:[margin-bottom:0.15rem]"><span>Why this?</span><p>{task.due < DEMO_DATE ? `This task is overdue since ${task.due}.` : `This is your earliest open deadline (${task.due}).`} It has {task.duration} minutes of estimated work{task.status === 'blocked' ? ' and a blocker that needs attention first' : ''}.</p></div>{accepted ? <p className="inline-flex items-center [gap:0.35rem] text-[length:0.82rem] [color:#4c856b] font-medium"><CheckCircle2 size={15} /> Added to today’s timeline</p> : <><p className="text-[length:0.78rem] text-(--muted-foreground)">{conflict ? '13:30 is occupied. Choose another slot in Calendar.' : 'Suggested slot: today, 13:30–14:30'}</p><div className="flex [gap:0.65rem] [margin-top:0.35rem]"><Button size="sm" disabled={!!conflict || task.status === 'blocked'} title={task.status === 'blocked' ? 'Resolve the blocker before scheduling focus time.' : undefined} onClick={() => setConfirm(true)}>Add focus time <ArrowRight size={14} /></Button><Button size="sm" variant="ghost" onClick={() => dismissRecommendation(id)}>Dismiss</Button></div>{task.status === 'blocked' && <p className="text-[length:0.78rem] text-(--muted-foreground)">Update the blocked task’s status before adding focus time.</p>}</>}<ConfirmationDialog open={confirm} onClose={() => setConfirm(false)} title="Add this focus session?" description="This updates your local demo calendar and timeline. No external calendar is connected." before="13:30–14:30 · open time" after={event.title} onConfirm={() => { const error = eventError(event, state.events); if (error) { notify(error); return } const result = addFocusTime(task.id); if (!result.ok) { notify(result.message); return } notify('Focus time added to today’s calendar.') }} /></div>
}
export function RecentActivity() {
  const { state } = useWorkspace()
  return <div className="flex flex-col [gap:0.65rem]">{activityService.list({ limit: 5 }).map((item, index) => <div className="flex [gap:0.65rem] text-[length:0.85rem] [&_small]:text-[length:0.74rem] [&_small]:text-(--muted-foreground)" key={`${item}-${index}`}><span className="[width:7px] [height:7px] rounded-full bg-(--primary) [margin-top:0.4rem]" /><div><p>{item}</p><small>{index === 0 && state.history.length ? 'Just now · local change' : 'Demo session'}</small></div></div>)}</div>
}
