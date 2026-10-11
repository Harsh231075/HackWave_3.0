import { useEffect, useState } from 'react'
import { googleCalendarService } from '@/services/googleCalendarService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GoogleMeetingForm } from './GoogleMeetingForm'
export function GoogleAvailabilityPanel() {
  const {date,setDate,timezone}=useGoogleCalendar()
  const [slots,setSlots]=useState<Array<{start:string;end:string}>>([])
  const [selected,setSelected]=useState<{start:string;end:string}|null>(null)
  const [arrange,setArrange]=useState(false)
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [revision,setRevision]=useState(0)
  useEffect(()=>{let active=true;void googleCalendarService.availability(date,60,timezone).then(result=>{if(active){setSlots(result.slots);setError('')}}).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:'Availability unavailable.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[date,timezone,revision])
  return <div className="space-y-4"><div className="flex flex-wrap items-center gap-3"><label className="text-sm" htmlFor="google-availability-date">Availability date</label><Input className="w-auto" id="google-availability-date" type="date" value={date} onChange={e=>{if(e.target.value){setDate(e.target.value);setSelected(null);setArrange(false);setLoading(true)}}}/><Button variant="outline" size="sm" onClick={()=>{setLoading(true);setRevision(v=>v+1)}}>Refresh slots</Button></div><p className="text-xs text-muted-foreground">Google primary calendar · 60-minute slots · {timezone}. Guest availability is unknown.</p>{loading&&<p role="status" className="text-sm">Checking availability…</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{slots.map(slot=><Button variant={selected?.start===slot.start?'secondary':'outline'} key={slot.start} onClick={()=>setSelected(slot)}>{new Date(slot.start).toLocaleTimeString('en-IN',{timeZone:timezone,hour:'2-digit',minute:'2-digit'})}</Button>)}</div>{!loading&&!error&&!slots.length&&<p className="text-sm text-muted-foreground">No free slots were found. Choose another date.</p>}<Button disabled={!selected} onClick={()=>setArrange(true)}>Use selected time</Button>{arrange&&selected&&<GoogleMeetingForm initialSlot={selected} goal="Schedule a meeting" onClose={()=>setArrange(false)} onCreated={()=>setRevision(v=>v+1)}/>}</div>
}
