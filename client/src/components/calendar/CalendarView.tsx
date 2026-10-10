import { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { WidgetHeaderContext } from '@/lib/workspace/WidgetHeaderContext'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { minutes } from '@/domain/workspace'
import type { Event } from '@/domain/types'
import { AvailabilityPanel, MeetingDetails, MeetingForm } from './CalendarWidgets'

const views = ['month', 'week', 'day', 'agenda'] as const
type CalendarMode = typeof views[number]
const categories = ['all', 'meeting', 'focus', 'class', 'break'] as const
function preference(key: string, fallback: string, allowed: readonly string[]) {
  try { const value = localStorage.getItem(key); return value && allowed.includes(value) ? value : fallback } catch { return fallback }
}
function savePreference(key: string, value: string) { try { localStorage.setItem(key, value) } catch { /* View changes still work when storage is unavailable. */ } }
const timeLabel = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`

export function CalendarView() {
  const { state, selectedDate, selectDate, dispatch } = useWorkspace()
  const headerSlot = useContext(WidgetHeaderContext)
  const [view, setView] = useState<CalendarMode>(() => preference('calendar-view', 'month', views) as CalendarMode)
  const [category, setCategory] = useState(() => preference('calendar-category', 'all', categories))
  const [selected, setSelected] = useState<string>()
  const [creation, setCreation] = useState<{ date: string; start: string }>()
  const [availability, setAvailability] = useState(false)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  const today = format(now, 'yyyy-MM-dd')
  const date = parseISO(selectedDate)
  const weekStart = startOfWeek(date, { weekStartsOn: 1 })
  const days = view === 'month' ? eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) }) : view === 'day' ? [date] : eachDayOfInterval({ start: weekStart, end: endOfWeek(date, { weekStartsOn: 1 }) })
  const events = state.events.filter(event => category === 'all' || event.category === category).sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))
  const tasks = state.tasks.filter(task => task.status !== 'completed')
  const label = view === 'month' ? format(date, 'MMMM yyyy') : view === 'day' ? format(date, 'EEE, MMM d, yyyy') : `${format(days[0], 'MMM d')} – ${format(days.at(-1)!, 'MMM d, yyyy')}`
  const move = (amount: number) => selectDate(format(view === 'month' ? addMonths(date, amount) : view === 'day' ? addDays(date, amount) : addWeeks(date, amount), 'yyyy-MM-dd'))
  const create = (day: string, start = '09:00') => { selectDate(day); setCreation({ date: day, start }) }
  const controls = <><div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label="Previous calendar period" onClick={() => move(-1)}><ChevronLeft size={16} /></Button><span className="calendar-period">{label}</span><Button variant="ghost" size="icon-sm" aria-label="Next calendar period" onClick={() => move(1)}><ChevronRight size={16} /></Button></div><Button variant="outline" size="sm" onClick={() => selectDate(today)}>Today</Button><Select items={views.map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }))} value={view} onValueChange={value => { if (value && views.includes(value as CalendarMode)) { setView(value as CalendarMode); savePreference('calendar-view', value) } }}><SelectTrigger size="sm" aria-label="Calendar view"><SelectValue /></SelectTrigger><SelectContent>{views.map(value => <SelectItem key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select><Button size="sm" onClick={() => create(selectedDate)}><Plus size={14} /> New event</Button></>
  const eventButton = (event: Event) => <button key={event.id} className={`calendar-event category-${event.category}`} onClick={() => setSelected(event.id)} title={`${event.start}–${event.end} ${event.title}`}><strong>{event.start}–{event.end}</strong><span>{event.title}</span></button>
  const agenda = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd')
    const dayEvents = events.filter(event => event.date === key)
    const dayTasks = tasks.filter(task => task.due === key)
    return <section key={key} className="calendar-agenda-day"><div className="flex items-center justify-between gap-2"><h3>{format(day, 'EEE, MMM d')}</h3><Button variant="ghost" size="icon-sm" aria-label={`New event on ${key}`} onClick={() => create(key)}><Plus size={14} /></Button></div>{dayEvents.map(eventButton)}{dayTasks.map(task => <p key={task.id} className="calendar-task-deadline">Due · {task.title}</p>)}{!dayEvents.length && !dayTasks.length && <p className="text-sm text-muted-foreground">No events</p>}</section>
  }
  const visibleEvents = events.filter(event => days.some(day => format(day, 'yyyy-MM-dd') === event.date))
  const startHour = Math.min(8, ...visibleEvents.map(event => Math.floor(minutes(event.start) / 60)))
  const endHour = Math.max(18, ...visibleEvents.map(event => Math.ceil(minutes(event.end) / 60)))
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return <>
    {headerSlot ? createPortal(controls, headerSlot) : headerSlot === undefined ? <div className="mb-4 flex flex-wrap items-center gap-2">{controls}</div> : null}
    <div className="calendar-secondary-controls"><Select items={categories.map(value => ({ value, label: value === 'all' ? 'All events' : value[0].toUpperCase() + value.slice(1) }))} value={category} onValueChange={value => { if (value && categories.includes(value as typeof categories[number])) { setCategory(value); savePreference('calendar-category', value) } }}><SelectTrigger size="sm" aria-label="Event category"><SelectValue /></SelectTrigger><SelectContent>{categories.map(value => <SelectItem key={value} value={value}>{value === 'all' ? 'All events' : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent></Select><Button variant={availability ? 'secondary' : 'ghost'} size="sm" aria-expanded={availability} onClick={() => setAvailability(!availability)}>Availability</Button>{state.history.length > 0 && <Button variant="ghost" size="icon-sm" aria-label="Undo calendar change" onClick={() => dispatch({ type: 'undo' })}><Undo2 size={14} /></Button>}</div>
    <div className={`calendar-content${availability ? ' with-availability' : ''}`}><div className="min-w-0">
    {view === 'month' ? <><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-month-grid">{days.map(day => {
      const key = format(day, 'yyyy-MM-dd')
      const dayEvents = events.filter(event => event.date === key)
      const due = tasks.filter(task => task.due === key)
      return <div key={key} className={`calendar-month-cell${day.getMonth() !== date.getMonth() ? ' outside' : ''}${key === selectedDate ? ' selected' : ''}`}><div className="calendar-day-heading"><button aria-label={`Select ${key}`} aria-pressed={key === selectedDate} className={key === today ? 'today' : ''} onClick={() => selectDate(key)}>{format(day, 'd')}</button><Button variant="ghost" size="icon-sm" className="calendar-day-add" aria-label={`New event on ${key}`} onClick={() => create(key)}><Plus size={12} /></Button></div><button className="calendar-empty-slot" aria-label={`Create event on ${key}`} onClick={() => create(key)} /><div className="calendar-month-events">{dayEvents.slice(0, 2).map(eventButton)}{due.length > 0 && <span className="calendar-task-deadline">{due.length} due</span>}{dayEvents.length > 2 && <button className="text-xs text-muted-foreground text-left" onClick={() => { selectDate(key); setView('day'); savePreference('calendar-view', 'day') }}>+{dayEvents.length - 2} more</button>}</div><div className="calendar-event-dots" aria-label={`${dayEvents.length} events, ${due.length} deadlines`}>{dayEvents.slice(0, 3).map(event => <i key={event.id} className={`category-${event.category}`} />)}{due.length > 0 && <i className="deadline-dot" />}</div></div>
    })}</div></> : view === 'agenda' ? <div className="calendar-agenda-list">{days.map(agenda)}</div> : <div className="calendar-time-scroll"><div className={`calendar-time-grid ${view === 'week' ? 'is-week' : ''}`} style={{ gridTemplateColumns: `48px repeat(${days.length}, minmax(0, 1fr))` }}><div />{days.map(day => <button className={`calendar-time-day${format(day, 'yyyy-MM-dd') === today ? ' today' : ''}`} key={day.toISOString()} onClick={() => selectDate(format(day, 'yyyy-MM-dd'))}>{format(day, 'EEE d')}<span className="calendar-task-deadline">{tasks.filter(task => task.due === format(day, 'yyyy-MM-dd')).length || ''}</span></button>)}<div className="calendar-hour-labels" style={{ height: hours.length * 60 }}>{hours.map(hour => <span key={hour} style={{ top: (hour - startHour) * 60 }}>{timeLabel(hour * 60)}</span>)}</div>{days.map(day => {
      const key = format(day, 'yyyy-MM-dd')
      return <div key={key} className="calendar-time-column" style={{ height: hours.length * 60 }}>{hours.flatMap(hour => [0, 30].map(minute => <button key={`${hour}-${minute}`} className="calendar-time-slot" style={{ top: (hour - startHour) * 60 + minute }} aria-label={`New event on ${key} at ${timeLabel(hour * 60 + minute)}`} onClick={() => create(key, timeLabel(hour * 60 + minute))} />))}{events.filter(event => event.date === key).map(event => <button key={event.id} className={`calendar-event calendar-positioned-event category-${event.category}`} style={{ top: minutes(event.start) - startHour * 60, height: Math.max(18, minutes(event.end) - minutes(event.start)) }} onClick={() => setSelected(event.id)} title={`${event.start}–${event.end} ${event.title}`}><strong>{event.start}–{event.end}</strong><span>{event.title}</span></button>)}{key === today && nowMinutes >= startHour * 60 && nowMinutes < endHour * 60 && <div className="calendar-now-line" style={{ top: nowMinutes - startHour * 60 }} aria-label="Current time" />}</div>
    })}</div></div>}
    {view === 'month' && <div className="calendar-selected-agenda">{agenda(date)}</div>}
    </div>{availability && <aside className="calendar-availability" aria-label="Availability"><AvailabilityPanel /></aside>}</div>
    <MeetingDetails key={selected} event={state.events.find(event => event.id === selected)} onClose={() => setSelected(undefined)} />
    {creation && <MeetingForm key={`${creation.date}-${creation.start}`} open date={creation.date} start={creation.start} onClose={() => setCreation(undefined)} />}
  </>
}
