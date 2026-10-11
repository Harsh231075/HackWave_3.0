import { calendarDate } from '@/domain/calendar'
import { useComponentView } from '@/state/ComponentViewContext'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { SelectedMeeting } from '@/components/resources/MeetingPreparationWidgets'
import { availabilityService } from '@/services'
import { useContext, useId, useState } from 'react'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { WidgetPageActionsContext } from '@/lib/workspace/WidgetHeaderContext'
import { format, parseISO } from 'date-fns'
import { ArrowUpRight, CalendarDays, Clock3, Plus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DataState, StatusBadge, type DisplayState } from '@/components/feedback/common'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE, DEMO_TIME } from '@/data/demo'
import { minutes } from '@/domain/workspace'
import type { Event } from '@/domain/types'

export function MeetingForm({ open, onClose, date, start = '13:30', event: initial, duration=60 }: { duration?:number; open: boolean; onClose: () => void; date: string; start?: string; event?: Event }) {
  const { saveEvent, notify } = useWorkspace()
  const [title, setTitle] = useState(initial?.title ?? '')
  const [day, setDay] = useState(initial?.date ?? date)
  const [begin, setBegin] = useState(initial?.start ?? start)
  const [end, setEnd] = useState(initial?.end ?? (`${String(Math.floor(Math.min(1439,minutes(start)+duration)/60)).padStart(2,'0')}:${String(Math.min(1439,minutes(start)+duration)%60).padStart(2,'0')}`))
  const [participants, setParticipants] = useState(initial?.participants.join(', ') ?? 'Maya')
  const [agenda, setAgenda] = useState(initial?.agenda ?? '')
  const [category, setCategory] = useState<Event['category']>(initial?.category ?? 'meeting')
  const [error, setError] = useState('')
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{initial ? 'Edit session' : 'Schedule a session'}</DialogTitle><DialogDescription>Changes are saved on this device.</DialogDescription></DialogHeader><form className="flex flex-col gap-4 [&_label]:flex [&_label]:flex-col [&_label]:[gap:0.35rem] [&_label]:text-[length:0.84rem] [&_label]:font-medium [&_select]:bg-(--background) [&_select]:[border:1px_solid_var(--border)] [&_select]:rounded-[var(--radius)] [&_select]:[padding:0.5rem_0.75rem] [&_select]:text-[length:0.88rem] [&_select]:text-(--foreground) [&_input]:bg-(--background) [&_input]:[border:1px_solid_var(--border)] [&_input]:rounded-[var(--radius)] [&_input]:[padding:0.5rem_0.75rem] [&_input]:text-[length:0.88rem] [&_input]:text-(--foreground) [&_textarea]:bg-(--background) [&_textarea]:[border:1px_solid_var(--border)] [&_textarea]:rounded-[var(--radius)] [&_textarea]:[padding:0.5rem_0.75rem] [&_textarea]:text-[length:0.88rem] [&_textarea]:text-(--foreground)" onSubmit={e => {
    e.preventDefault()
    const result = saveEvent({ id: initial?.id, title, date: day, start: begin, end, category, participants: participants.split(','), agenda })
    if (!result.ok) { setError(result.message); return }
    notify('Event saved.'); onClose()
  }}><label>Session title<Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Research check-in" maxLength={120} required autoFocus /></label><div className="grid grid-cols-2 [gap:0.85rem]"><label>Date<Input type="date" value={day} onChange={e => setDay(e.target.value)} required /></label><label>Type<select value={category} onChange={e => setCategory(e.target.value as Event['category'])}><option value="meeting">Meeting</option><option value="focus">Focus session</option><option value="class">Class / learning</option><option value="break">Break</option></select></label><label>Start time<Input type="time" value={begin} onChange={e => setBegin(e.target.value)} required /></label><label>End time<Input type="time" value={end} onChange={e => setEnd(e.target.value)} required /></label></div><label>Participants<Input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="Names, separated by commas" maxLength={300} /></label><label>Agenda / description<Textarea value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="What would you like to cover?" rows={3} maxLength={3000} /></label>{error && <p role="alert" className="[color:#ef4444] text-[length:0.8rem] font-medium">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit">{initial ? 'Save changes' : 'Schedule session'}</Button></DialogFooter></form></DialogContent></Dialog>
}

export function MeetingCard({ event, onSelect }: { event: Event; onSelect: () => void }) {
  return <article className="flex items-center [gap:0.85rem] [padding:0.85rem_1rem] bg-(--background) [border:1px_solid_var(--border)] rounded-[var(--radius)] [transition:all_0.15s] hover:bg-(--surface-hover) hover:border-(--ring)"><div className={`[&.category-meeting]:[background:rgba(69,_106,_82,_0.15)] [&.category-meeting]:text-(--cat-meeting) [&.category-focus]:[background:rgba(76,_133,_107,_0.15)] [&.category-focus]:text-(--cat-focus) [&.category-class]:[background:rgba(245,_158,_11,_0.15)] [&.category-class]:text-(--cat-class) [&.category-break]:[background:rgba(150,_131,_107,_0.15)] [&.category-break]:text-(--cat-break) w-10 h-10 rounded-[var(--radius)] inline-flex items-center justify-center shrink-0 category-${event.category}`}><CalendarDays size={19} /></div><div className="flex-1 flex flex-col [gap:0.2rem] [&_button]:text-left [&_button]:font-semibold [&_button]:text-[length:0.92rem] [&_p]:text-[length:0.82rem] [&_p]:text-(--muted-foreground)"><button onClick={onSelect}>{event.title}</button><p>{format(parseISO(event.date), 'EEE, MMM d')} <span>·</span> {event.start}–{event.end}</p>{event.participants.length > 0 && <div className="flex items-center gap-2 [margin-top:0.2rem]"><div className="flex [&_span]:w-5 [&_span]:h-5 [&_span]:rounded-full [&_span]:bg-(--accent) [&_span]:text-(--primary) [&_span]:text-[length:0.68rem] [&_span]:font-bold [&_span]:inline-flex [&_span]:items-center [&_span]:justify-center [&_span]:[border:1.5px_solid_var(--card)] [&_span]:[margin-left:-5px] [&_span:first-child]:[margin-left:0]">{event.participants.slice(0, 3).map(name => <span key={name} title={name}>{name.slice(0, 1)}</span>)}</div><small>{event.participants.length} participants</small></div>}</div><Button variant="ghost" size="icon-sm" onClick={onSelect} aria-label={`Details for ${event.title}`}><ArrowUpRight size={17} /></Button></article>
}

export function MeetingDetails({ event, onClose }: { event?: Event; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  const [deleting,setDeleting]=useState(false)
  const { deleteEvent, notify } = useWorkspace()
  if (!event) return null
  if (editing) return <MeetingForm key={event.id} open date={event.date} event={event} onClose={() => { setEditing(false); onClose() }} />
  return <Dialog open onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{event.title}</DialogTitle><DialogDescription>{format(parseISO(event.date), 'EEEE, MMMM d')} · {event.start}–{event.end}</DialogDescription></DialogHeader><StatusBadge tone="high">{event.category}</StatusBadge><p className="detail-line"><Users size={16} /> {event.participants.join(', ') || 'Personal session'}</p><div className="detail-notes"><h3>Agenda</h3><p>{event.agenda || 'No agenda yet. Add one by editing this session.'}</p></div><p className="text-[length:0.78rem] text-(--muted-foreground)">Times use your device’s local timezone.</p><DialogFooter>{deleting&&<p className="text-sm">Confirm deletion of this local event. Undo can restore it.</p>}<Button variant="destructive" onClick={() => { if(!deleting){setDeleting(true);return} const result = deleteEvent(event.id); if (!result.ok) { notify(result.message); return } notify('Event deleted. Use Undo to restore it.'); onClose() }}>{deleting?'Confirm delete event':'Delete event'}</Button><Button variant="outline" onClick={onClose}>Close</Button><Button onClick={() => setEditing(true)}>Edit session</Button></DialogFooter></DialogContent></Dialog>
}

export function MeetingList({ displayState }: { displayState?: DisplayState }) {
  const { state, selectedDate } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string>()
  const scope = useMeetingScope()
  const today=useComponentView()?.plan.referenceDate??calendarDate()
  const events = state.events.filter(event => event.date >= today).filter(event => event.category === 'meeting' || event.category === 'class').sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  if (scope) return <SelectedMeeting />
  return <><WidgetActions><span className="text-[length:0.78rem] text-(--muted-foreground)">{events.length} upcoming sessions</span><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Plus size={14} /> Schedule</Button></WidgetActions><DataState state={displayState ?? (events.length ? 'ready' : 'empty')}><div className="flex flex-col [gap:0.65rem]">{events.map(event => <MeetingCard key={event.id} event={event} onSelect={() => setSelected(event.id)} />)}</div></DataState><MeetingForm key={`${open}-${selectedDate}`} open={open} onClose={() => setOpen(false)} date={selectedDate} /><MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} /></>
}

export { CalendarView } from './CalendarView'

export function AvailabilityPanel() {
  const dateInputId = useId()
  const { selectedDate, selectDate } = useWorkspace()
  const [slot, setSlot] = useState<string>()
  const [open, setOpen] = useState(false)
  const [duration,setDuration]=useState(60),[workStart,setWorkStart]=useState('09:00'),[workEnd,setWorkEnd]=useState('18:00')
  const formatTime=(value:number)=>`${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`
  const valid=duration>=15&&duration<=240&&Number.isInteger(duration)&&minutes(workStart)<minutes(workEnd)
  const times=valid?Array.from({length:Math.max(0,Math.floor((minutes(workEnd)-minutes(workStart)-duration)/30)+1)},(_,index)=>formatTime(minutes(workStart)+index*30)):[]
  const endFor=(start:string)=>formatTime(minutes(start)+duration)
  const busy = (start: string) => !availabilityService.isAvailable({ date: selectedDate, start, end: endFor(start) })
  return <div className="flex flex-col [gap:0.85rem]"><p className="text-[length:0.78rem] text-(--muted-foreground)">{duration}-minute slots · local time</p><label className="sr-only" htmlFor={dateInputId}>Availability date</label><Input id={dateInputId} type="date" value={selectedDate} onChange={e => { if (e.target.value) { selectDate(e.target.value); setSlot(undefined) } }} /><div className="grid grid-cols-3 gap-2"><label className="text-xs">Minutes<Input type="number" min={15} max={240} value={duration} onChange={e=>{setDuration(Number(e.target.value));setSlot(undefined)}}/></label><label className="text-xs">Work start<Input type="time" value={workStart} onChange={e=>{setWorkStart(e.target.value);setSlot(undefined)}}/></label><label className="text-xs">Work end<Input type="time" value={workEnd} onChange={e=>{setWorkEnd(e.target.value);setSlot(undefined)}}/></label></div>{!valid&&<p role="alert">Choose 15–240 minutes and an end after the start.</p>}<div className="grid grid-cols-2 [gap:0.65rem]">{times.map(time => <button key={time} className={`flex flex-col items-start [padding:0.75rem_0.9rem] bg-(--background) [border:1px_solid_var(--border)] rounded-[var(--radius)] [transition:all_0.15s] [&:not(:disabled):hover]:bg-(--surface-hover) [&:not(:disabled):hover]:border-(--ring) [&.selected]:bg-(--accent) [&.selected]:border-(--primary) [&.selected]:text-(--primary) disabled:opacity-50 disabled:bg-(--muted) disabled:cursor-not-allowed [&_span]:font-semibold [&_span]:text-[length:0.95rem] [&_span]:mt-1 [&_small]:text-[length:0.74rem] [&_small]:text-(--muted-foreground) ${slot === time ? 'selected' : ''}`} disabled={busy(time)} aria-pressed={slot === time} onClick={() => setSlot(time)}><Clock3 size={14} /><span>{time}</span><small>{busy(time) ? 'Busy' : 'Available'}</small></button>)}</div>{slot && busy(slot) && <p className="[color:#ef4444] text-[length:0.8rem] font-medium" role="alert">This slot is now occupied. Choose another time.</p>}<div className="flex items-center [gap:0.4rem] text-[length:0.8rem] text-(--muted-foreground)"><span className="[width:7px] [height:7px] rounded-full [background:#10b981] inline-block mr-2 shadow-[0_0_6px_#10b981]" /><p>Open time is calculated from the sessions in your calendar.</p></div><Button className="w-full" disabled={!slot || busy(slot)} onClick={() => setOpen(true)}>Use selected time</Button><MeetingForm key={`${open}-${slot}-${selectedDate}`} open={open} onClose={() => { setOpen(false); setSlot(undefined) }} date={selectedDate} start={slot} duration={duration} /></div>
}

export function TimeBlockCard({ event, onSelect }: { event: Event; onSelect: () => void }) {
  return <button className={`[&.category-meeting]:[background:rgba(69,_106,_82,_0.15)] [&.category-meeting]:text-(--cat-meeting) [&.category-focus]:[background:rgba(76,_133,_107,_0.15)] [&.category-focus]:text-(--cat-focus) [&.category-class]:[background:rgba(245,_158,_11,_0.15)] [&.category-class]:text-(--cat-class) [&.category-break]:[background:rgba(150,_131,_107,_0.15)] [&.category-break]:text-(--cat-break) flex flex-col text-left [padding:0.65rem_0.85rem] rounded-[var(--radius)] [border:1px_solid_var(--border)] text-[length:0.84rem] [transition:all_0.15s] [&_small]:text-[length:0.75rem] [&_small]:text-(--muted-foreground) category-${event.category}`} onClick={onSelect}><span className="font-semibold text-[length:0.88rem]">{event.title}</span><span>{event.start}–{event.end} <i>·</i> {minutes(event.end) - minutes(event.start)} min</span><small>{event.category === 'focus' ? 'Protected focus time' : event.category === 'break' ? 'A little breathing room' : `${event.participants.length} participants`}</small></button>
}

export function DailyTimeline() {
  const pageActions = useContext(WidgetPageActionsContext)
  const { state, selectedDate, selectDate } = useWorkspace()
  const [selected, setSelected] = useState<string>()
  const [creating,setCreating]=useState(false)
  const scope=useComponentView()?.plan.bindings
  const canCreate=!scope?.projectId&&!scope?.clientId
  const events = state.events.filter(event=>event.date===selectedDate).sort((a,b)=>a.start.localeCompare(b.start))
  const planned = events.reduce((sum, event) => sum + minutes(event.end) - minutes(event.start), 0)
  const controls = <><label><span className="sr-only">Timeline date</span><input type="date" value={selectedDate} onChange={e => { if (e.target.value) selectDate(e.target.value) }} /></label><span className="text-[length:0.78rem] text-(--muted-foreground)">{(planned / 60).toFixed(1)}h planned</span><Button variant="outline" size="sm" disabled={!canCreate} title={canCreate?undefined:'Create new local blocks in an unscoped Timeline or Calendar view.'} onClick={()=>setCreating(true)}><Plus size={14}/> Add block</Button></>
  return <>{pageActions ? <WidgetActions>{controls}</WidgetActions> : <div className="flex justify-between items-center mb-3 text-[length:0.84rem]">{controls}</div>}<div className="flex flex-col [border-left:2px_solid_var(--border)] ml-12">{[8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(hour => {
    const starting = events.filter(event => Number(event.start.slice(0, 2)) === hour)
    const occupied = events.some(event => minutes(event.start) < (hour + 1) * 60 && minutes(event.end) > hour * 60)
    return <div className="flex relative [min-height:52px] [border-bottom:1px_dashed_var(--border)]" key={hour}><span className="absolute [left:-3.5rem] [top:-0.6rem] text-[length:0.76rem] [font-family:var(--font-mono)] text-(--muted-foreground)">{String(hour).padStart(2, '0')}:00</span><div className="flex-1 [padding:0.35rem_0_0.35rem_1rem] flex flex-col [gap:0.35rem]">{selectedDate === DEMO_DATE && hour === 9 && <div className="absolute [left:-2px] right-0 top-3 h-0.5 [background:#ef4444] text-[length:0.72rem] font-semibold [color:#ef4444] flex items-center pl-2"><span />{DEMO_TIME} · demo now</div>}{starting.map(event => <TimeBlockCard key={event.id} event={event} onSelect={() => setSelected(event.id)} />)}{!starting.length && !occupied && <span className="text-[length:0.76rem] text-(--muted-foreground) italic [padding-top:0.35rem]">Open time</span>}{!starting.length && occupied && <span className="text-[length:0.76rem] text-(--muted-foreground) opacity-70">Session continues</span>}</div></div>
  })}{events.filter(event => Number(event.start.slice(0, 2)) < 8 || Number(event.start.slice(0, 2)) >= 18).map(event => <div className="flex relative [min-height:52px] [border-bottom:1px_dashed_var(--border)]" key={event.id}><span className="absolute [left:-3.5rem] [top:-0.6rem] text-[length:0.76rem] [font-family:var(--font-mono)] text-(--muted-foreground)">{event.start}</span><TimeBlockCard event={event} onSelect={() => setSelected(event.id)} /></div>)}</div><MeetingForm key={selectedDate+'-'+creating} open={creating} date={selectedDate} onClose={()=>setCreating(false)}/><MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} /></>
}
