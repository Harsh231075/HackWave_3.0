import { useEffect, useId, useState } from 'react'
import { googleCalendarService } from '@/services/googleCalendarService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleMeetingForm } from './GoogleMeetingForm'
type Slot = { start: string; end: string }
export function GoogleAvailabilityPanel() {
  const calendar = useGoogleCalendar()
  const { date, setDate, timezone } = calendar
  const id = useId()
  const [snapshot, setSnapshot] = useState<{ key: string; slots: Slot[]; error: string } | null>(null)
  const [selection, setSelection] = useState<{ key: string; slot: Slot } | null>(null)
  const [arrange, setArrange] = useState(false)
  const [duration,setDuration]=useState(60),[workStart,setWorkStart]=useState('09:00'),[workEnd,setWorkEnd]=useState('18:00')
  const [revision, setRevision] = useState(0)
  const key = `${calendar.connection?.accountId}:${date}:${timezone}:${revision}:${calendar.revision}:${duration}:${workStart}:${workEnd}`
  const selected = selection?.key === key ? selection.slot : null
  useEffect(() => {
    const controller = new AbortController()
    void googleCalendarService.availability(date, duration, timezone, controller.signal,{workStart,workEnd}).then(result => {
      if (!controller.signal.aborted) setSnapshot({ key, slots: result.slots, error: '' })
    }).catch(failure => {
      if (!controller.signal.aborted) setSnapshot({ key, slots: [], error: failure instanceof Error ? failure.message : 'Availability unavailable.' })
    })
    return () => controller.abort()
  }, [date, timezone, key, duration, workStart, workEnd])
  const loading = snapshot?.key !== key
  const slots = !loading ? snapshot.slots : []
  const error = !loading ? snapshot.error : ''
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><label className="text-sm" htmlFor={id}>Availability date</label><Input className="w-auto" id={id} type="date" value={date} onChange={event => { if (event.target.value) { setDate(event.target.value); setArrange(false) } }} /><Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)}>Refresh slots</Button></div>
    <p className="text-xs text-muted-foreground">Google primary calendar · {duration}-minute slots · {timezone}. Guest availability is unknown.</p>
    <div className="grid grid-cols-3 gap-2"><label className="text-xs">Minutes<Input type="number" min={15} max={240} value={duration} onChange={e=>{setDuration(Number(e.target.value));setArrange(false)}}/></label><label className="text-xs">Work start<Input type="time" value={workStart} onChange={e=>{setWorkStart(e.target.value);setArrange(false)}}/></label><label className="text-xs">Work end<Input type="time" value={workEnd} onChange={e=>{setWorkEnd(e.target.value);setArrange(false)}}/></label></div>
    {loading && <p role="status">Checking availability…</p>}{error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(slot => <Button variant={selected?.start === slot.start ? 'secondary' : 'outline'} key={slot.start} onClick={() => setSelection({ key, slot })}>{new Date(slot.start).toLocaleTimeString('en-IN', { timeZone: timezone, hour: '2-digit', minute: '2-digit' })}</Button>)}</div>
    {!loading && !error && !slots.length && <p>No free slots were found. Choose another date.</p>}
    <Button disabled={!selected} onClick={() => setArrange(true)}>Use selected time</Button>
    {arrange && selected && <GoogleMeetingForm key={key + selected.start} initialSlot={selected} goal="Schedule a meeting" onClose={() => setArrange(false)} onCreated={() => setRevision(value => value + 1)} />}
  </div>
}
