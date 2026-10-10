import { useState } from 'react'
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, StatusBadge, type DisplayState } from '@/components/feedback/common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE, DEMO_TIME } from '@/data/demo'
import { eventError, minutes } from '@/domain/workspace'
import type { Event } from '@/domain/types'

export function MeetingForm({ open, onClose, date, start = '13:30', event: initial }: { open: boolean; onClose: () => void; date: string; start?: string; event?: Event }) {
  const { state, dispatch, notify } = useWorkspace()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [day, setDay] = useState(initial?.date ?? date)
  const [begin, setBegin] = useState(initial?.start ?? start)
  const [end, setEnd] = useState(initial?.end ?? `${String(Math.min(23, Number(start.slice(0, 2)) + 1)).padStart(2, '0')}:${start.slice(3)}`)
  const [participants, setParticipants] = useState(initial?.participants.join(', ') ?? 'Maya')
  const [agenda, setAgenda] = useState(initial?.agenda ?? '')
  const [category, setCategory] = useState<Event['category']>(initial?.category ?? 'meeting')
  const [error, setError] = useState('')
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{initial ? 'Edit session' : 'Schedule a session'}</DialogTitle><DialogDescription>Check your demo calendar and save this session locally.</DialogDescription></DialogHeader><form className="form-stack" onSubmit={e => {
    e.preventDefault()
    const event: Event = { id: initial?.id ?? crypto.randomUUID(), role: state.role, title: title.trim(), date: day, start: begin, end, category, participants: participants.split(',').map(name => name.trim()).filter(Boolean), agenda }
    const validation = eventError(event, state.events)
    if (validation) { setError(validation); return }
    dispatch({ type: 'event', event }); notify('Session saved to your calendar and daily timeline.'); onClose()
  }}><label>Session title<Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Research check-in" maxLength={120} required autoFocus /></label><div className="form-grid"><label>Date<Input type="date" value={day} onChange={e => setDay(e.target.value)} required /></label><label>Type<select value={category} onChange={e => setCategory(e.target.value as Event['category'])}><option value="meeting">Meeting</option><option value="focus">Focus session</option><option value="class">Class / learning</option><option value="break">Break</option></select></label><label>Start time<Input type="time" value={begin} onChange={e => setBegin(e.target.value)} required /></label><label>End time<Input type="time" value={end} onChange={e => setEnd(e.target.value)} required /></label></div><label>Participants<Input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="Names, separated by commas" maxLength={300} /></label><label>Agenda / description<Textarea value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="What would you like to cover?" rows={3} maxLength={3000} /></label>{error && <p role="alert" className="field-error">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? 'Save changes' : 'Schedule session'}</Button></DialogFooter></form></DialogContent></Dialog>
}

export function MeetingCard({ event, onSelect }: { event: Event; onSelect: () => void }) {
  return <article className="meeting-card"><div className={`meeting-icon category-${event.category}`}><CalendarDays size={19} /></div><div className="meeting-info"><button onClick={onSelect}>{event.title}</button><p>{format(parseISO(event.date), 'EEE, MMM d')} <span>·</span> {event.start}–{event.end}</p>{event.participants.length > 0 && <div className="participant-row"><div className="avatar-stack">{event.participants.slice(0, 3).map(name => <span key={name} title={name}>{name.slice(0, 1)}</span>)}</div><small>{event.participants.length} participants</small></div>}</div><Button variant="ghost" size="icon-sm" onClick={onSelect} aria-label={`Details for ${event.title}`}><ArrowUpRight size={17} /></Button></article>
}

export function MeetingDetails({ event, onClose }: { event?: Event; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  if (!event) return null
  if (editing) return <MeetingForm key={event.id} open date={event.date} event={event} onClose={() => { setEditing(false); onClose() }} />
  return <Dialog open onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{event.title}</DialogTitle><DialogDescription>{format(parseISO(event.date), 'EEEE, MMMM d')} · {event.start}–{event.end}</DialogDescription></DialogHeader><StatusBadge tone="high">{event.category}</StatusBadge><p className="detail-line"><Users size={16} /> {event.participants.join(', ') || 'Personal session'}</p><div className="detail-notes"><h3>Agenda</h3><p>{event.agenda || 'No agenda yet. Add one by editing this session.'}</p></div><p className="subtle-label">Demo session. External meeting links are not connected.</p><DialogFooter><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => setEditing(true)}>Edit session</Button></DialogFooter></DialogContent></Dialog>
}

export function MeetingList({ displayState }: { displayState?: DisplayState }) {
  const { state, selectedDate } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const events = state.events.filter(event => event.role === state.role && (event.category === 'meeting' || event.category === 'class') && event.date >= DEMO_DATE).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  return <><div className="section-actions"><span className="subtle-label">{events.length} upcoming sessions</span><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Schedule</Button></div><DataState state={displayState ?? (events.length ? 'ready' : 'empty')}><div className="meeting-list">{events.map(event => <MeetingCard key={event.id} event={event} onSelect={() => setSelected(event.id)} />)}</div></DataState><MeetingForm key={`${open}-${selectedDate}`} open={open} onClose={() => setOpen(false)} date={selectedDate} /><MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} /></>
}

export function CalendarView() {
  const { state, selectedDate, selectDate } = useWorkspace()
  const [view, setView] = useState<'month' | 'week' | 'day'>('month')
  const [selected, setSelected] = useState<string>()
  const [add, setAdd] = useState(false)
  const date = parseISO(selectedDate)
  const days = view === 'month' ? eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) }) : view === 'week' ? eachDayOfInterval({ start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }) : [date]
  const events = state.events.filter(event => event.role === state.role)
  const tasks = state.tasks.filter(task => task.role === state.role && task.status !== 'completed')
  const move = (amount: number) => selectDate(format(view === 'month' ? addMonths(date, amount) : view === 'week' ? addWeeks(date, amount) : addDays(date, amount), 'yyyy-MM-dd'))
  return <><div className="calendar-toolbar"><div className="calendar-navigation"><Button variant="ghost" size="icon-sm" onClick={() => move(-1)} aria-label="Previous calendar period"><ChevronLeft size={16} /></Button><h3>{format(date, 'MMMM yyyy')}</h3><Button variant="ghost" size="icon-sm" onClick={() => move(1)} aria-label="Next calendar period"><ChevronRight size={16} /></Button><Button variant="outline" size="sm" onClick={() => selectDate(DEMO_DATE)}>Today</Button></div><div className="segmented-control" aria-label="Calendar view">{(['month', 'week', 'day'] as const).map(mode => <button key={mode} aria-pressed={mode === view} className={mode === view ? 'active' : ''} onClick={() => setView(mode)}>{mode}</button>)}</div></div>{view === 'month' ? <div className="calendar-month"><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map(day => {
    const key = format(day, 'yyyy-MM-dd')
    const dayEvents = events.filter(event => event.date === key)
    const dayTasks = tasks.filter(task => task.due === key)
    return <div key={key} className={`calendar-cell ${day.getMonth() !== date.getMonth() ? 'outside-month' : ''} ${key === selectedDate ? 'selected-day' : ''}`}><button className={`calendar-date ${key === DEMO_DATE ? 'today' : ''}`} aria-label={`Select ${format(day, 'EEEE MMMM d')}`} aria-pressed={key === selectedDate} onClick={() => selectDate(key)}>{format(day, 'd')}</button>{dayEvents.slice(0, 2).map(event => <button className={`calendar-event category-${event.category}`} key={event.id} onClick={() => setSelected(event.id)} title={`${event.start} ${event.title}`}>{event.start} {event.title}</button>)}{dayTasks.length > 0 && <span className="calendar-deadline">{dayTasks.length} task{dayTasks.length > 1 ? 's' : ''} due</span>}{dayEvents.length > 2 && <button className="calendar-more" onClick={() => { selectDate(key); setView('day') }}>+{dayEvents.length - 2} more</button>}</div>
  })}</div></div> : <div className={`calendar-agenda ${view === 'week' ? 'week-agenda' : ''}`}>{days.map(day => {
    const key = format(day, 'yyyy-MM-dd')
    const dayEvents = events.filter(event => event.date === key).sort((a, b) => a.start.localeCompare(b.start))
    return <section key={key}><h4><button onClick={() => selectDate(key)}>{format(day, 'EEE, MMM d')}</button></h4>{dayEvents.map(event => <button key={event.id} className={`agenda-event category-${event.category}`} onClick={() => setSelected(event.id)}><strong>{event.start}–{event.end}</strong><span>{event.title}</span></button>)}{tasks.filter(task => task.due === key).map(task => <div className="agenda-deadline" key={task.id}>Due: {task.title}</div>)}{!dayEvents.length && <p className="subtle-label">No sessions scheduled</p>}</section>
  })}</div>}<div className="calendar-mobile-agenda"><h4>{format(date, 'EEEE, MMM d')}</h4>{events.filter(event => event.date === selectedDate).map(event => <MeetingCard key={event.id} event={event} onSelect={() => setSelected(event.id)} />)}</div><div className="calendar-footer"><span><i className="legend-dot category-meeting" />Meeting <i className="legend-dot category-focus" />Focus <i className="legend-dot category-class" />Class</span><Button size="sm" variant="outline" onClick={() => setAdd(true)}><Plus size={14} /> Add session</Button></div><MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} /><MeetingForm key={`${add}-${selectedDate}`} open={add} onClose={() => setAdd(false)} date={selectedDate} /></>
}

export function AvailabilityPanel() {
  const { state, selectedDate, selectDate } = useWorkspace()
  const [slot, setSlot] = useState<string>()
  const [open, setOpen] = useState(false)
  const times = ['09:00', '10:00', '11:00', '13:30', '14:30', '15:30']
  const endFor = (start: string) => `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:${start.slice(3)}`
  const busy = (start: string) => !!eventError({ id: 'slot-preview', role: state.role, title: 'Slot', date: selectedDate, start, end: endFor(start), category: 'meeting', participants: [], agenda: '' }, state.events)
  return <div className="availability"><p className="subtle-label">One-hour slots · demo local time</p><label className="sr-only" htmlFor="availability-date">Availability date</label><Input id="availability-date" type="date" value={selectedDate} onChange={e => { if (e.target.value) { selectDate(e.target.value); setSlot(undefined) } }} /><div className="slot-grid">{times.map(time => <button key={time} className={`time-slot ${slot === time ? 'selected' : ''}`} disabled={busy(time)} aria-pressed={slot === time} onClick={() => setSlot(time)}><Clock3 size={14} /><span>{time}</span><small>{busy(time) ? 'Busy' : 'Available'}</small></button>)}</div>{slot && busy(slot) && <p className="field-error" role="alert">This slot is now occupied. Choose another time.</p>}<div className="availability-note"><span className="live-dot" /><p>Open time is calculated from the sessions in your calendar.</p></div><Button className="w-full" disabled={!slot || busy(slot)} onClick={() => setOpen(true)}>Use selected time</Button><MeetingForm key={`${open}-${slot}-${selectedDate}`} open={open} onClose={() => { setOpen(false); setSlot(undefined) }} date={selectedDate} start={slot} /></div>
}

export function TimeBlockCard({ event, onSelect }: { event: Event; onSelect: () => void }) {
  return <button className={`time-block category-${event.category}`} onClick={onSelect}><span className="time-block-title">{event.title}</span><span>{event.start}–{event.end} <i>·</i> {minutes(event.end) - minutes(event.start)} min</span><small>{event.category === 'focus' ? 'Protected focus time' : event.category === 'break' ? 'A little breathing room' : `${event.participants.length} participants`}</small></button>
}

export function DailyTimeline() {
  const { state, selectedDate, selectDate } = useWorkspace()
  const [selected, setSelected] = useState<string>()
  const events = state.events.filter(event => event.role === state.role && event.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start))
  const planned = events.reduce((sum, event) => sum + minutes(event.end) - minutes(event.start), 0)
  return <><div className="timeline-heading"><label><span className="sr-only">Timeline date</span><input type="date" value={selectedDate} onChange={e => { if (e.target.value) selectDate(e.target.value) }} /></label><span className="subtle-label">{(planned / 60).toFixed(1)}h planned</span></div><div className="timeline">{[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => {
    const starting = events.filter(event => Number(event.start.slice(0, 2)) === hour)
    const occupied = events.some(event => minutes(event.start) < (hour + 1) * 60 && minutes(event.end) > hour * 60)
    return <div className="timeline-row" key={hour}><span className="timeline-time">{String(hour).padStart(2, '0')}:00</span><div className="timeline-content">{selectedDate === DEMO_DATE && hour === 9 && <div className="now-line"><span />{DEMO_TIME} · demo now</div>}{starting.map(event => <TimeBlockCard key={event.id} event={event} onSelect={() => setSelected(event.id)} />)}{!starting.length && !occupied && <span className="free-time">Open time</span>}{!starting.length && occupied && <span className="continuation">Session continues</span>}</div></div>
  })}{events.filter(event => Number(event.start.slice(0, 2)) < 8 || Number(event.start.slice(0, 2)) >= 18).map(event => <div className="timeline-row" key={event.id}><span className="timeline-time">{event.start}</span><TimeBlockCard event={event} onSelect={() => setSelected(event.id)} /></div>)}</div><MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} /></>
}
