import toast from 'react-hot-toast'
import { isServiceError } from '@/services/serviceErrors'
import { useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3 } from 'lucide-react'
import { googleCalendarService } from '@/services/googleCalendarService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { calendarDate, eventDraftSchema, shiftDate, zonedInstant, type CalendarEvent, type EventDraft } from '@/domain/calendar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { ReactNode } from 'react'
import { GoogleEventDetails } from './GoogleCalendarWidgets'

function MeetingActions({ children }: { children: ReactNode }) { return <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">{children}</div> }
type Preview = { id: string; draft: EventDraft; accountId: string }
function restoredPreview(accountId?: string): Preview | null {
  try { const parsed = JSON.parse(sessionStorage.getItem('orlo-event-preview') ?? 'null') as Preview | null; return parsed && parsed.accountId === accountId && eventDraftSchema.safeParse(parsed.draft).success ? parsed : null } catch { return null }
}
export function GoogleMeetingForm({ goal, onClose, onCreated, initialSlot, initialDate }: { initialDate?: string; initialSlot?: {start:string;end:string}; goal: string; onClose: () => void; onCreated: (event: CalendarEvent) => void }) {
  const calendar = useGoogleCalendar()
  const [initial] = useState(() => restoredPreview(calendar.connection?.accountId))
  const [title, setTitle] = useState(initial?.draft.title ?? goal.replace(/^(?:please\s+)?(?:schedule|arrange|book|create|set up)\s+(?:a\s+)?/i, '').slice(0, 200))
  const [date, setDate] = useState(() => initial ? calendarDate(new Date(initial.draft.start), initial.draft.timezone) : initialSlot ? calendarDate(new Date(initialSlot.start),calendar.timezone) : initialDate ?? shiftDate(calendarDate(new Date(), calendar.timezone), /tomorrow/i.test(goal) ? 1 : 0))
  const [timezone, setTimezone] = useState(initial?.draft.timezone ?? calendar.timezone)
  const [duration, setDuration] = useState(() => initial ? Math.round((Date.parse(initial.draft.end) - Date.parse(initial.draft.start)) / 60000) : initialSlot ? Math.round((Date.parse(initialSlot.end)-Date.parse(initialSlot.start))/60000) : Number(goal.match(/(\d+)\s*(?:minute|min)\b/i)?.[1] ?? 30))
  const [emails, setEmails] = useState(initial?.draft.attendees.join(', ') ?? '')
  const [agenda, setAgenda] = useState(initial?.draft.description ?? '')
  const [time, setTime] = useState(() => initial ? new Intl.DateTimeFormat('en-GB', { timeZone: initial.draft.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(initial.draft.start)) : '')
  const [slots, setSlots] = useState<Array<{ start: string; end: string }>>([])
  const [slot, setSlot] = useState<{ start: string; end: string } | null>(initialSlot??null)
  const [searched, setSearched] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<CalendarEvent | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [today] = useState(() => calendarDate(new Date(), calendar.timezone))
  useEffect(() => {
    if (!initial) return
    let active = true
    void googleCalendarService.operation(initial.id).then(result => {
      if (!active) return
      if (result.state === 'created' && result.event) { setCreated(result.event); sessionStorage.removeItem('orlo-event-preview') }
      setUncertain(result.state === 'pending')
    }).catch(failure => { if (active) { setUncertain(true); setError(failure instanceof Error ? failure.message : 'Check the existing preview before arranging another meeting.') } })
    return () => { active = false }
  }, [initial])
  function clearSlots() { setSlot(null); setSlots([]); setSearched(false) }
  async function findSlots() {
    setBusy(true); setError('')
    try { const result = await googleCalendarService.availability(date, duration, timezone); setSlots(result.slots); setSearched(true); setSlot(null) }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to find available slots.') }
    finally { setBusy(false) }
  }
  async function review() {
    setBusy(true); setError('')
    try {
      if (/\bwith\b/i.test(goal) && !emails.trim()) throw new Error('Enter the participant’s email address before reviewing the meeting.')
      const start = slot?.start ?? zonedInstant(date, time, timezone)
      const end = slot?.end ?? new Date(Date.parse(start) + duration * 60000).toISOString()
      const draft = eventDraftSchema.parse({ title, description: agenda, start, end, timezone, attendees: emails.split(',').map(e => e.trim()).filter(Boolean) })
      const result = await googleCalendarService.preview(draft)
      const saved = { id: result.id, draft, accountId: calendar.connection!.accountId! }
      setPreview(saved)
      sessionStorage.setItem('orlo-event-preview', JSON.stringify(saved))
    } catch (failure) { setError(failure instanceof Error ? (/ZodError/.test(failure.name) ? 'Check the title, date, time, timezone and participant email addresses.' : failure.message) : 'Unable to prepare your preview.') }
    finally { setBusy(false) }
  }
  async function confirm() {
    if (!preview) return
    setBusy(true); setError('')
    try {
      const result = await googleCalendarService.confirm(preview.id)
      if (result.state !== 'created' || !result.event) { setUncertain(true); setError('The meeting is still being created. Check again; another event will not be added.'); toast('Meeting creation is still pending. Check status before retrying.'); return }
      toast.success('Meeting created in Google Calendar.');setCreated(result.event); setUncertain(false); sessionStorage.removeItem('orlo-event-preview'); calendar.refreshEvents(); onCreated(result.event)
    } catch (failure) { setUncertain(!isServiceError(failure) || ![400, 403, 404, 409].includes(failure.status ?? 0)); const message=failure instanceof Error ? failure.message : 'Creation status is uncertain. Check again before creating another meeting.';setError(message);toast.error(message) }
    finally { setBusy(false) }
  }
  return <section aria-label="Meeting scheduling" className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-6"><header><h3 className="text-lg font-semibold">{created ? 'Meeting created' : preview ? 'Review your meeting' : 'Arrange a meeting'}</h3><p className="mt-1 text-sm text-muted-foreground">{created ? 'Saved in your Google Calendar.' : 'Choose the details and review them before sending invitations.'}</p></header>
    {created ? <div className="space-y-4"><p className="flex items-center gap-2 text-sm text-primary"><CheckCircle2 size={18} /> Your meeting is confirmed.</p><GoogleEventDetails event={created} /><MeetingActions><Button onClick={onClose}>Done</Button></MeetingActions></div> : preview ? <div className="space-y-4">
      <div className="rounded-xl border border-border bg-muted p-4 text-sm"><h3 className="font-semibold">{preview.draft.title}</h3><p className="mt-2">{new Date(preview.draft.start).toLocaleString('en-IN', { timeZone: preview.draft.timezone })} – {new Date(preview.draft.end).toLocaleString('en-IN', { timeZone: preview.draft.timezone })}</p><p className="text-xs text-muted-foreground">{preview.draft.timezone}</p><p className="mt-2 break-words">{preview.draft.attendees.join(', ') || 'Personal meeting · no guests'}</p><p className="mt-2 whitespace-pre-wrap">{preview.draft.description}</p></div>
      <p className="text-xs text-muted-foreground">Confirming creates a real Google Calendar event and sends invitations to the listed guests. Other attendees’ availability has not been verified.</p>
      {!calendar.connection?.canWrite && <Button type="button" variant="outline" onClick={() => { sessionStorage.setItem('orlo-calendar-resume', goal); calendar.connect(true) }}>Allow event creation</Button>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <MeetingActions><Button variant="outline" disabled={busy || uncertain} onClick={() => { setPreview(null); sessionStorage.removeItem('orlo-event-preview') }}>Edit details</Button><Button disabled={busy || !calendar.connection?.canWrite} onClick={() => void confirm()}>{busy ? 'Checking…' : uncertain ? 'Check / retry confirmation' : 'Confirm and create'}</Button></MeetingActions>
    </div> : <form className="space-y-4 [&_label]:block [&_label]:text-sm [&_label]:font-medium" onSubmit={e => { e.preventDefault(); void review() }}>
      <label>Meeting title<Input value={title} onChange={e => setTitle(e.target.value)} maxLength={200} required disabled={busy} /></label>
      <label>Participant emails<Input value={emails} onChange={e => setEmails(e.target.value)} placeholder="alex@example.com, teammate@example.com" disabled={busy} required={/\bwith\b/i.test(goal)} /><span className="text-xs font-normal text-muted-foreground">Enter email addresses; we won’t guess who a name refers to.</span></label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><label>Date<Input type="date" value={date} min={today} onChange={e => { setDate(e.target.value); clearSlots() }} required disabled={busy} /></label><label>Duration (minutes)<Input type="number" min={15} max={240} step={15} value={duration} onChange={e => { setDuration(Number(e.target.value)); clearSlots() }} required disabled={busy} /></label><label>Timezone<Input value={timezone} onChange={e => { setTimezone(e.target.value); clearSlots() }} required disabled={busy} /></label><label>Preferred start time<Input type="time" value={time} onChange={e => { setTime(e.target.value); setSlot(null) }} disabled={busy} required={!slot} /></label></div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void findSlots()}><Clock3 size={15} /> {busy ? 'Checking…' : 'Find available slots'}</Button>
      {searched && <div className="space-y-2"><p className="text-xs text-muted-foreground">Your primary calendar · suggested working hours 09:00–18:00. Guest availability is unknown.</p>{!slots.length && <p className="text-sm">No free slots were found. Choose another date or time.</p>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(item => <button type="button" key={item.start} disabled={busy} aria-pressed={slot?.start === item.start} className={`rounded-lg border px-3 py-2 text-sm ${slot?.start === item.start ? 'border-primary bg-accent text-primary' : 'border-border hover:bg-muted'}`} onClick={() => { setSlot(item); setTime('') }}>{new Date(item.start).toLocaleTimeString('en-IN', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}</button>)}</div></div>}
      <label>Agenda / description<Textarea value={agenda} onChange={e => setAgenda(e.target.value)} maxLength={5000} rows={3} disabled={busy} /></label>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <MeetingActions><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || !title.trim() || (!time && !slot)}><CalendarDays size={15} /> Review meeting</Button></MeetingActions>
    </form>}
  </section>
}
