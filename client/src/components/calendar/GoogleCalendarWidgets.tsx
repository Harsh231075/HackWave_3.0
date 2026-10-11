import { GoogleEventActions } from './GoogleEventActions'
import { GoogleMeetingForm } from './GoogleMeetingForm'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'
import { useComponentView } from '@/state/ComponentViewContext'
import { useEffect, useId, useState } from 'react'
import { CalendarDays, Link2, RefreshCw, Unplug } from 'lucide-react'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { googleCalendarService } from '@/services/googleCalendarService'
import { calendarWindow, displayEventTime, type CalendarEvent } from '@/domain/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function GoogleCalendarConnection() {
  const { connection, loading, error, connect, disconnect, refresh } = useGoogleCalendar()
  const [failure, setFailure] = useState('')
  const [busy, setBusy] = useState(false)
  return <div className="space-y-3 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><CalendarDays size={18} /><div><p className="text-sm font-medium">Google Calendar</p><p className="text-xs text-muted-foreground">{loading ? 'Checking connection…' : connection?.connected ? connection.email : 'Connect your calendar to prepare and schedule real meetings.'}</p></div></div>
      {connection?.connected ? <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => { setBusy(true); void disconnect().catch(e => setFailure(e.message)).finally(() => setBusy(false)) }}><Unplug size={14} /> Disconnect</Button> : <Button type="button" size="sm" disabled={loading || !connection?.configured} onClick={() => connect()}><Link2 size={14} /> Connect Google Calendar</Button>}
    </div>
    {!connection?.connected && connection?.configured && <p className="text-xs text-muted-foreground">On Google’s permissions screen, select access to view your calendar events before continuing. Google sign-in alone does not connect the calendar.</p>}
    {!loading && connection && !connection.configured && <p className="text-xs text-muted-foreground">Google OAuth is not configured on this server yet.</p>}
    {(failure || error) && <div className="flex items-center justify-between gap-2"><p className="text-xs text-destructive" role="alert">{failure || error}</p><Button variant="ghost" size="sm" onClick={() => void refresh()}>Retry</Button></div>}
  </div>
}

export function GoogleEventDetails({ event }: { event: CalendarEvent }) {
  const { timezone } = useGoogleCalendar()
  const safeLink = (url: string) => /^https:\/\//i.test(url) ? url : undefined
  return <div className="space-y-3 text-sm">
    <p className="font-medium">{event.title}</p><p className="text-muted-foreground">{displayEventTime(event, timezone)}</p>
    {event.location && <p>{event.location}</p>}
    <p className="text-muted-foreground">{event.attendees.length ? event.attendees.map(a => a.name ? `${a.name} (${a.email})` : a.email).join(', ') : 'No attendees listed'}</p>
    {event.description && <p className="whitespace-pre-wrap break-words rounded-lg bg-muted p-3">{event.description}</p>}
    <GoogleEventActions event={event}/><div className="flex flex-wrap gap-3">{safeLink(event.url) && <a className="text-primary underline" href={event.url} target="_blank" rel="noreferrer">Open in Google Calendar</a>}{safeLink(event.meetingUrl) && <a className="text-primary underline" href={event.meetingUrl} target="_blank" rel="noreferrer">Join meeting</a>}</div>
  </div>
}

export function GoogleCalendarWidget() {
  const calendar = useGoogleCalendar()
  const dayInput = useId()
  const component = useComponentView()
  const mode = component?.plan.bindings.calendarView ?? 'day'
  const day = parseISO(calendar.date)
  const range = component?.plan.bindings.dateRange ?? (mode==='week'?{from:format(startOfWeek(day,{weekStartsOn:1}),'yyyy-MM-dd'),to:format(endOfWeek(day,{weekStartsOn:1}),'yyyy-MM-dd')}:mode==='month'?{from:format(startOfMonth(day),'yyyy-MM-dd'),to:format(endOfMonth(day),'yyyy-MM-dd')}:undefined)
  const { connection, date, timezone, revision } = calendar
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loadedAccount, setLoadedAccount] = useState('')
  const [loadedWindow, setLoadedWindow] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refreshedAt, setRefreshedAt] = useState('')
  const [creating,setCreating]=useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  useEffect(() => {
    if (!connection?.connected || !connection.accountId) return
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      try {
        const window = {from:calendarWindow(range?.from ?? date,timezone).from,to:calendarWindow(range?.to ?? date,timezone).to}
        void googleCalendarService.events(window.from, window.to, timezone, controller.signal).then(result => {
          if (controller.signal.aborted) return
          setEvents(result.events); setLoadedAccount(result.accountId); setLoadedWindow((range?.from??date)+':'+(range?.to??date)+':'+timezone); setError(''); setRefreshedAt(result.refreshedAt)
        }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Calendar unavailable.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Choose a valid date.'); setLoading(false) }
    }
    void load()
    return () => controller.abort()
  }, [connection?.connected, connection?.accountId, date, timezone, revision, range?.from, range?.to])
  if (!connection?.connected) return <div className="space-y-4"><GoogleCalendarConnection /><p className="text-xs text-muted-foreground">Connect the original Google account to view these events.</p></div>
  const visible = loadedAccount === connection.accountId && loadedWindow === (range?.from??date)+':'+(range?.to??date)+':'+timezone ? events : []
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><label className="sr-only" htmlFor={dayInput}>Calendar date</label><Input id={dayInput} className="w-auto" type="date" value={date} onChange={e => { if (e.target.value) calendar.setDate(e.target.value) }} /><span className="text-xs text-muted-foreground">{timezone}{range && range.from!==range.to ? ` · ${range.from} through ${range.to}` : ''}</span></div>{component && <select aria-label="Google calendar view" className="rounded-lg border border-border bg-card px-3 py-2 text-sm" value={mode} onChange={e=>component.change({calendarView:e.target.value as 'day'|'week'|'month'|'agenda',dateRange:undefined})}>{['day','week','month','agenda'].map(view=><option key={view} value={view}>{view==='agenda'?'Agenda':view[0].toUpperCase()+view.slice(1)+' window'}</option>)}</select>}<Button type="button" variant="outline" size="sm" disabled={loading} onClick={calendar.refreshEvents}><RefreshCw size={14} /> Refresh</Button></div>
    <Button size="sm" onClick={()=>setCreating(true)}>New meeting</Button><Dialog open={creating} onOpenChange={setCreating}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>New Google meeting</DialogTitle><DialogDescription>Review the details before creating the event.</DialogDescription></DialogHeader><GoogleMeetingForm initialDate={date} goal="" onClose={()=>setCreating(false)} onCreated={()=>calendar.refreshEvents()}/></DialogContent></Dialog>
    <p className="text-xs text-muted-foreground">Google Calendar · {connection.email}{refreshedAt && ` · Last refreshed ${new Date(refreshedAt).toLocaleTimeString()}`}</p>
    {loading && <p className="text-sm text-muted-foreground" role="status">Loading your calendar…</p>}
    {error && <div className="space-y-2"><p className="text-sm text-destructive" role="alert">{error} {visible.length > 0 ? 'The last successful snapshot is shown below.' : ''}</p><Button size="sm" variant="outline" onClick={() => calendar.connect()}>Reconnect calendar</Button></div>}
    {!loading && !error && !visible.length && <p className="rounded-xl bg-muted p-5 text-sm text-muted-foreground">No events on this date.</p>}
    <div className="space-y-2">{visible.map(event => <div key={event.id} className="rounded-xl border border-border p-3"><button type="button" className="flex w-full items-center gap-3 text-left" aria-expanded={selected === event.id} onClick={() => setSelected(selected === event.id ? null : event.id)}><CalendarDays size={17} className="shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{event.title}</span><span className="block text-xs text-muted-foreground">{displayEventTime(event, timezone)}</span></span></button>{selected === event.id && <div className="mt-3 border-t border-border pt-3"><GoogleEventDetails event={event} /></div>}</div>)}</div>
  </div>
}
