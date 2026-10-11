import { useResponseWidgets } from '@/state/ResponseWidgetsContext'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, FileText, Info, Save } from 'lucide-react'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { googleCalendarService } from '@/services/googleCalendarService'
import { calendarDate, calendarWindow, displayEventTime, type CalendarEvent } from '@/domain/calendar'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { GoogleCalendarConnection, GoogleCalendarWidget, GoogleEventDetails } from './GoogleCalendarWidgets'
import { GoogleMeetingForm } from './GoogleMeetingForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'

export type LiveRequest = { kind: 'prepare' | 'schedule'; goal: string; date: string; accountId?: string; eventId?: string; widgets?: Array<'details' | 'outline' | 'calendar'>; span?: 'wide' | 'narrow' | 'full' }
function CalendarNotes({ event, accountId }: { event: CalendarEvent; accountId: string }) {
  const { state, draftBuffers, editDraft, saveDraft, notify } = useWorkspace()
  const key = `google-preparation:${accountId}:${event.calendarId}:${event.id}`
  const value = draftBuffers[key] ?? state.drafts[key] ?? ''
  const dirty = value !== (state.drafts[key] ?? '')
  return <div className="space-y-3"><label className="sr-only" htmlFor="google-meeting-notes">Meeting preparation notes</label><Textarea id="google-meeting-notes" value={value} onChange={e => editDraft(key, e.target.value)} rows={8} maxLength={5000} placeholder="Write your agenda, questions and preparation notes…" /><div className="flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{dirty ? 'Unsaved notes · kept during layout changes' : 'Saved notes stay on this device'} · Google’s event description is unchanged</span><Button size="sm" disabled={!dirty} onClick={() => { const result = saveDraft(key, value); notify(result.ok ? 'Preparation notes saved on this device.' : result.message) }}><Save size={14} /> Save notes</Button></div></div>
}
export function LiveCalendarWorkspace({ request, onChange, onClose, onDemo }: { request: LiveRequest; onChange: (request: LiveRequest) => void; onClose: () => void; onDemo: () => void }) {
  const calendar = useGoogleCalendar()
  const requestedWidgets = useResponseWidgets()
  const onlyCalendar = requestedWidgets?.length === 1 && requestedWidgets[0] === 'calendar'
  const latestRequest = useRef(request)
  useEffect(() => { latestRequest.current = request }, [request])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [event, setEvent] = useState<CalendarEvent | null>(null)
  const [loadedAccount, setLoadedAccount] = useState('')
  const [rationale, setRationale] = useState('')
  const [source, setSource] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [reload, setReload] = useState(0)
  const accountId = calendar.connection?.accountId
  const widgets = (request.widgets ?? ['details', 'outline', 'calendar']).filter(widget => !requestedWidgets || requestedWidgets.includes(widget === 'details' ? 'context' : widget))
  useEffect(() => {
    if (onlyCalendar || !calendar.connection?.connected || !accountId || request.kind !== 'prepare') return
    const controller = new AbortController()
    const run = async () => {
      try {
        setPending(true)
        if (request.eventId) {
          const result = await googleCalendarService.prepare(request.eventId, request.goal, controller.signal)
          if (controller.signal.aborted) return
          setEvent(result.event); setLoadedAccount(result.accountId); setRationale(result.rationale); setSource(result.source); setError('')
          if (!latestRequest.current.widgets && latestRequest.current.eventId === request.eventId) onChange({ ...latestRequest.current, accountId: result.accountId, widgets: result.widgets })
        } else {
          const range = calendarWindow(request.date, calendar.timezone)
          const result = await googleCalendarService.events(range.from, range.to, calendar.timezone, controller.signal)
          if (controller.signal.aborted) return
          setEvents(result.events); setLoadedAccount(result.accountId); setError('')
          // Even one match is presented for selection; we never guess a person/client from a title.
        }
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to prepare this meeting.') }
      finally { if (!controller.signal.aborted) setPending(false) }
    }
    void run()
    return () => controller.abort()
    // Layout changes must not refetch or reset edited notes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendar.connection?.connected, accountId, request.kind, request.eventId, request.date, request.goal, calendar.timezone, reload, onlyCalendar])
  if (calendar.loading) return <p role="status" className="p-5 text-sm text-muted-foreground">Checking your calendar connection…</p>
  if (!calendar.connection?.connected) return <div className="space-y-4"><h2 className="text-xl font-semibold">Connect your calendar to continue</h2><GoogleCalendarConnection /><p className="text-sm text-muted-foreground">Your goal is kept while you connect. You can also use the local demo workflow.</p><div className="flex gap-2"><Button variant="outline" onClick={onClose}>Back to workspace</Button><Button variant="ghost" onClick={onDemo}>Use demo records</Button></div></div>
  if (request.accountId && request.accountId !== accountId) return <div className="space-y-3"><p role="alert" className="text-sm">This preparation belongs to a different calendar account. Choose a meeting from the connected account.</p><Button variant="outline" onClick={() => onChange({ ...request, accountId, eventId: undefined, widgets: undefined })}>Choose a meeting</Button></div>
  if (onlyCalendar) return <Card><CardHeader><CardTitle>Calendar</CardTitle></CardHeader><CardContent><GoogleCalendarWidget /></CardContent></Card>
  if (request.kind === 'schedule') return <div className="space-y-5"><GoogleMeetingForm goal={request.goal} onClose={onClose} onCreated={created => { calendar.setDate(calendarDate(new Date(created.start), calendar.timezone)) }} /><GoogleCalendarWidget /></div>
  const visible = loadedAccount === accountId
  const selected = visible ? event : null
  return <div className="space-y-5">
    {!requestedWidgets && <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-medium text-primary">GOOGLE CALENDAR · {calendar.connection.email}</p><h2 className="mt-1 text-xl font-semibold">{selected && request.eventId ? 'Prepare for your meeting' : 'Choose a meeting to prepare'}</h2></div><Button variant="outline" size="sm" onClick={onClose}>Back to workspace</Button></div>}
    {pending && <p className="text-sm text-muted-foreground" role="status">{request.eventId ? 'Preparing your workspace…' : 'Finding your meetings…'}</p>}
    {error && <div className="flex flex-wrap items-center gap-3"><p className="text-sm text-destructive" role="alert">{error}</p><Button size="sm" variant="outline" onClick={() => setReload(n => n + 1)}>Retry</Button><Button size="sm" variant="ghost" onClick={() => calendar.connect()}>Reconnect</Button></div>}
    {!request.eventId ? <div className="space-y-3"><div className="flex flex-wrap items-center gap-3"><label className="text-sm" htmlFor="prepare-meeting-date">Meeting date</label><Input className="w-auto" id="prepare-meeting-date" type="date" value={request.date} onChange={e => { if (e.target.value) { setEvent(null); onChange({ ...request, date: e.target.value }) } }} /><span className="text-xs text-muted-foreground">{calendar.timezone}</span></div>{visible && events.map(item => <button type="button" key={item.id} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left hover:bg-accent" onClick={() => { setEvent(null); calendar.setDate(request.date); onChange({ ...request, accountId, eventId: item.id, widgets: undefined }) }}><CalendarDays size={18} className="text-primary" /><span><span className="block text-sm font-medium">{item.title}</span><span className="text-xs text-muted-foreground">{displayEventTime(item, calendar.timezone)}</span></span></button>)}{!pending && !error && visible && !events.length && <div className="space-y-3 rounded-xl border border-border p-5"><p className="text-sm">No meeting was found on this date. Choose another date or arrange a new one.</p><Button onClick={() => onChange({ ...request, kind: 'schedule', eventId: undefined })}>Arrange a meeting</Button></div>}</div> : selected ? <>
      {!requestedWidgets && <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground"><Info size={15} className="mt-0.5 shrink-0" /><p>{rationale} {source === 'local' ? 'A reliable local layout is used when AI composition is unavailable.' : ''} Project documents and email history are not connected to this event.</p></div>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">{widgets.map(widget => <Card key={widget} className={`min-w-0 ${widget === 'calendar' ? request.span === 'narrow' ? 'lg:col-span-5' : request.span === 'wide' ? 'lg:col-span-7' : 'lg:col-span-12' : 'lg:col-span-6'}`}><CardHeader><CardTitle className="flex items-center gap-2 text-base">{widget === 'outline' ? <FileText size={16} /> : <CalendarDays size={16} />}{widget === 'details' ? 'Meeting details' : widget === 'outline' ? 'Preparation notes' : 'Calendar'}</CardTitle></CardHeader><CardContent>{widget === 'details' ? <GoogleEventDetails event={selected} /> : widget === 'outline' ? <CalendarNotes event={selected} accountId={accountId!} /> : <GoogleCalendarWidget />}</CardContent></Card>)}</div>
    </> : null}
  </div>
}
