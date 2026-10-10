import { useState } from 'react'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmationDialog, DataState } from './common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { eventError } from '@/domain/workspace'
import type { Event } from '@/domain/types'

export function RecommendationCard() {
  const { state, dispatch, notify } = useWorkspace()
  const [confirm, setConfirm] = useState(false)
  const task = state.tasks.filter(task => task.role === state.role && task.status !== 'completed').sort((a, b) => a.due.localeCompare(b.due))[0]
  if (!task) return <DataState state="empty" empty="All caught up. There’s no outstanding work to recommend."><span /></DataState>
  const id = `recommendation-${state.role}-${task.id}`
  const event: Event = { id, role: state.role, title: `Focus: ${task.title}`, date: DEMO_DATE, start: '13:30', end: '14:30', category: 'focus', participants: [], agenda: `Work on ${task.title}. Context: ${task.context}.` }
  const accepted = state.events.some(item => item.id === id)
  const conflict = eventError(event, state.events)
  if (state.dismissed.includes(id)) return <div className="empty-state"><CheckCircle2 size={22} /><p>Recommendation dismissed.</p><small>Use Undo edit to bring it back.</small></div>
  return <div className="recommendation"><div className="recommendation-tag"><Sparkles size={14} /> A thoughtful next step <span>Static example</span></div><h3>Make a little space for your priority.</h3><p>Reserve a focus session for <strong>{task.title.toLowerCase()}</strong>.</p><div className="recommendation-reason"><span>Why this?</span><p>{task.due < DEMO_DATE ? `This task is overdue since ${task.due}.` : `This is your earliest open deadline (${task.due}).`} It has {task.duration} minutes of estimated work{task.status === 'blocked' ? ' and a blocker that needs attention first' : ''}.</p></div>{accepted ? <p className="save-feedback"><CheckCircle2 size={15} /> Added to today’s timeline</p> : <><p className="subtle-label">{conflict ? '13:30 is occupied. Choose another slot in Calendar.' : 'Suggested slot: today, 13:30–14:30'}</p><div className="recommendation-actions"><Button size="sm" disabled={!!conflict || task.status === 'blocked'} title={task.status === 'blocked' ? 'Resolve the blocker before scheduling focus time.' : undefined} onClick={() => setConfirm(true)}>Add focus time <ArrowRight size={14} /></Button><Button size="sm" variant="ghost" onClick={() => dispatch({ type: 'dismiss', id })}>Dismiss</Button></div>{task.status === 'blocked' && <p className="subtle-label">Update the blocked task’s status before adding focus time.</p>}</>}<ConfirmationDialog open={confirm} onClose={() => setConfirm(false)} title="Add this focus session?" description="This updates your local demo calendar and timeline. No external calendar is connected." before="13:30–14:30 · open time" after={event.title} onConfirm={() => { const error = eventError(event, state.events); if (error) { notify(error); return } dispatch({ type: 'event', event }); notify('Focus time added to today’s calendar.') }} /></div>
}
export function RecentActivity() {
  const { state } = useWorkspace()
  return <div className="activity-list">{state.activity.slice(0, 5).map((item, index) => <div className="activity-item" key={`${item}-${index}`}><span className="activity-dot" /><div><p>{item}</p><small>{index === 0 && state.history.length ? 'Just now · local change' : 'Demo session'}</small></div></div>)}</div>
}
