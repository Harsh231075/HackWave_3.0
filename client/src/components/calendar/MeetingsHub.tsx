import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { CalendarDays, Edit3, FileText, List, Plus, RefreshCw, Trash2, Users, Video } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { useDisplayPreferences } from '@/hooks/useDisplayPreferences'
import { useGoogleEventsWindow } from '@/hooks/useGoogleEventsWindow'
import { calendarDate, displayEventTime, shiftDate } from '@/domain/calendar'
import { isUpcoming, projectGoogleEvents } from '@/domain/meetingCalendar'
import { minutes } from '@/domain/workspace'

import { CalendarView } from './CalendarView'
import { MeetingDetails, MeetingForm } from './CalendarWidgets'
import { GoogleCalendarConnection, GoogleEventDetails } from './GoogleCalendarWidgets'
import { GoogleMeetingForm } from './GoogleMeetingForm'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { Event } from '@/domain/types'

export function MeetingsHub({ compact = false }: { compact?: boolean }) {
  const workspace = useWorkspace(), google = useGoogleCalendar(), preferences = useDisplayPreferences()
  const [params, setParams] = useSearchParams()
  const [localView, setLocalView] = useState<'list'|'calendar'>('list')
  const view = compact ? localView : params.get('view') === 'calendar' ? 'calendar' : 'list'
  const [source, setSource] = useState('all')
  const [selected, setSelected] = useState<{source:'google'|'local';id:string;account?:string}|null>(null)
  const [editingLocal, setEditingLocal] = useState<Event | null>(null)
  const [cancelingLocal, setCancelingLocal] = useState<Event | null>(null)
  const [creation, setCreation] = useState<{source:'google'|'local';date:string;start:string}|null>(null)
  const [notice] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => { const timer = window.setInterval(()=>setNow(Date.now()),60000); return ()=>window.clearInterval(timer) }, [])

  const date = workspace.selectedDate
  const day = parseISO(date)
  const mode = preferences.calendarView
  const from = view === 'list' ? date : mode === 'month' ? format(startOfWeek(startOfMonth(day),{weekStartsOn:1}),'yyyy-MM-dd') : mode === 'day' ? date : format(startOfWeek(day,{weekStartsOn:1}),'yyyy-MM-dd')
  const to = view === 'list' ? shiftDate(date,30) : mode === 'month' ? format(endOfWeek(endOfMonth(day),{weekStartsOn:1}),'yyyy-MM-dd') : mode === 'day' ? date : format(endOfWeek(day,{weekStartsOn:1}),'yyyy-MM-dd')

  const remote = useGoogleEventsWindow(from,to,source !== 'local')
  const local = source === 'google' ? [] : workspace.state.events
  const remoteEvents = source === 'local' ? [] : remote.events

  const list = [
    ...local.filter(e=>(e.category==='meeting'||e.category==='class')&&e.date>=from&&e.date<=to&&Date.parse(`${e.date}T${e.end}`)>now).map(e=>({source:'local' as const,id:e.id,title:e.title,sort:`${e.date}T${e.start}`,local:e})),
    ...remoteEvents.filter(e=>isUpcoming(e,now,google.timezone)).map(e=>({source:'google' as const,id:e.id,title:e.title,sort:e.allDay?e.start:calendarDate(new Date(e.start),google.timezone)+'T'+new Intl.DateTimeFormat('en-GB',{timeZone:google.timezone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(e.start)),remote:e})),
  ].sort((a,b)=>a.sort.localeCompare(b.sort))

  const projected = projectGoogleEvents(remoteEvents,from,to,google.timezone)

  const changeView = (next:'list'|'calendar') => {
    if(compact) setLocalView(next)
    else setParams(previous=>{const value=new URLSearchParams(previous);value.set('view',next);return value})
  }

  const create = (date:string,start='09:00') => setCreation({source:source !== 'local' && google.connection?.connected?'google':'local',date,start})
  const currentRemote = selected?.source==='google' && selected.account===google.connection?.accountId ? remoteEvents.find(e=>e.id===selected.id) : undefined

  function confirmCancelLocal(event: Event) {
    const result = workspace.deleteEvent(event.id)
    if (!result.ok) {
      workspace.notify('message' in result && result.message ? result.message : 'Unable to cancel meeting.')
      return
    }
    workspace.notify(`Meeting "${event.title}" cancelled. Undo can restore it.`,'success')
    setCancelingLocal(null)
  }

  return (
    <section aria-label="Meetings workspace" className="space-y-6">
      <WidgetActions>
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Meeting view">
          <Button size="sm" variant={view==='list'?'secondary':'ghost'} aria-pressed={view==='list'} onClick={()=>changeView('list')}><List size={14}/>List</Button>
          <Button size="sm" variant={view==='calendar'?'secondary':'ghost'} aria-pressed={view==='calendar'} onClick={()=>changeView('calendar')}><CalendarDays size={14}/>Calendar</Button>
        </div>
        <select aria-label="Meeting source" className="rounded-lg border bg-card px-3 py-1.5 text-sm" value={source} onChange={event=>{setSource(event.target.value);setSelected(null)}}>
          <option value="all">All sources</option><option value="google">Google Calendar</option><option value="local">Local</option>
        </select>
        <Button size="sm" variant="outline" disabled={remote.loading} onClick={google.refreshEvents}><RefreshCw size={14}/>Refresh</Button>
        <Button size="sm" variant="outline" onClick={()=>create(date)}><Plus size={14}/>New meeting</Button>
      </WidgetActions>

      {notice && <p role="status" className="rounded-lg bg-muted p-3 text-sm">{notice}</p>}
      {source!=='local' && !google.connection?.connected && <GoogleCalendarConnection/>}
      {remote.loading && <p role="status" className="text-sm text-muted-foreground">Updating Google Calendar…</p>}
      {remote.error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
          <p role="alert" className="text-sm text-destructive font-medium">
            {remote.error}{remoteEvents.length?' · Last successful Google snapshot is shown.':' · Google events could not be loaded.'}
          </p>
          <Button variant="outline" size="sm" className="mt-2" onClick={google.refreshEvents}>Retry</Button>
        </div>
      )}
      {google.connection?.connected && source!=='local' && (
        <p className="text-xs text-muted-foreground">
          Google primary calendar · {google.connection.email} · {google.timezone}
          {remote.refreshedAt?` · Last synced ${new Date(remote.refreshedAt).toLocaleTimeString()}`:''}
        </p>
      )}

      {/* Main View Area */}
      {view==='calendar' ? (
        <CalendarView
          displayEvents={[...local, ...projected]}
          onExternalSelect={id => {
            const item = projected.find(e => e.id === id)
            if(!item) return false
            const event = remoteEvents.find(e => id === `google:${e.id}:${item.date}`)
            if(event) setSelected({ source:'google', id:event.id, account:google.connection?.accountId })
            return true
          }}
          onCreate={create}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {list.length} upcoming sessions · {from} through {to}
              {remote.loading||remote.error?' · Google count incomplete':''}
            </p>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              From
              <Input
                aria-label="Meetings start date"
                type="date"
                className="w-auto text-foreground"
                value={date}
                onChange={e=>{if(e.target.value) workspace.selectDate(e.target.value)}}
              />
            </label>
          </div>

          <div className="grid gap-3.5">
            {list.map(item => {
              const isLocal = item.source === 'local'
              const localEvent = isLocal ? item.local : undefined
              const remoteEvent = !isLocal ? item.remote : undefined

              const agendaText = isLocal ? localEvent?.agenda : remoteEvent?.description
              const meetUrlMatch = agendaText?.match(/https?:\/\/[^\s]+/)?.[0]
              const demo = isLocal && (localEvent?.id.startsWith('demo-preview-') || /^Demo ·/i.test(localEvent?.title ?? ''))
              const joinUrl = demo ? undefined : !isLocal ? (remoteEvent?.meetingUrl || meetUrlMatch) : meetUrlMatch

              const attendees = isLocal
                ? (localEvent?.participants ?? [])
                : (remoteEvent?.attendees.map(a => a.name || a.email) ?? [])

              const timeDisplay = isLocal && localEvent
                ? `${format(parseISO(localEvent.date), 'EEE, MMM d')} · ${localEvent.start}–${localEvent.end} (${minutes(localEvent.end) - minutes(localEvent.start)}m)`
                : remoteEvent
                ? displayEventTime(remoteEvent, google.timezone)
                : ''

              return (
                <article
                  key={item.source + item.id}
                  className="rounded-xl border border-border bg-card p-4 shadow-2xs transition-all hover:border-border/80"
                >
                  {/* Top line badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${
                        item.source === 'google'
                          ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      }`}>
                        {item.source === 'google' ? 'Google Calendar' : 'Local'}
                      </span>
                      {isLocal && localEvent && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground capitalize">
                          {localEvent.category}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-muted-foreground">{timeDisplay}</span>
                  </div>

                  {/* Title & Attendees */}
                  <div className="mt-2.5">
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      {item.title}
                    </h2>
                    {attendees.length > 0 && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users size={14} className="shrink-0" />
                        <span>{attendees.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Agenda snippet */}
                  {agendaText && (
                    <div className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground/80 mb-0.5">Agenda / Notes:</p>
                      <p className="line-clamp-2 whitespace-pre-wrap">{agendaText}</p>
                    </div>
                  )}

                  {/* Action Buttons Row */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {joinUrl && (
                        <a
                          href={joinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex"
                        >
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs font-medium">
                            <Video size={13} className="mr-1.5" />
                            Join call
                          </Button>
                        </a>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          if (isLocal) setSelected({ source:'local', id:item.id })
                          else setSelected({ source:'google', id:item.id, account:google.connection?.accountId })
                        }}
                      >
                        <FileText size={13} className="mr-1.5" />
                        Details
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isLocal && localEvent && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingLocal(localEvent)}
                          >
                            <Edit3 size={13} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:bg-destructive/10"
                            onClick={() => setCancelingLocal(localEvent)}
                          >
                            <Trash2 size={13} className="mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {!list.length && !remote.loading && !remote.error && (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              <p>No upcoming sessions found in this window.</p>
              <div className="mt-3 flex justify-center gap-2">
                <Button size="sm" variant="outline" onClick={() => create(date)}>
                  <Plus size={14} className="mr-1.5" /> Create meeting
                </Button>

              </div>
            </div>
          )}
        </>
      )}

      {/* Details Dialogs */}
      <MeetingDetails
        event={selected?.source==='local'?workspace.state.events.find(e=>e.id===selected.id):undefined}
        onClose={()=>setSelected(null)}
      />

      {selected?.source==='google' && (
        <Dialog open onOpenChange={open=>{if(!open)setSelected(null)}}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Meeting details</DialogTitle>
              <DialogDescription>Google Calendar · {google.timezone}</DialogDescription>
            </DialogHeader>
            {currentRemote ? <GoogleEventDetails event={currentRemote}/> : <p>This meeting is no longer in this view. Refresh or check the original account.</p>}
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Local Meeting Modal */}
      {editingLocal && (
        <MeetingForm
          open
          date={editingLocal.date}
          start={editingLocal.start}
          event={editingLocal}
          onClose={() => setEditingLocal(null)}
        />
      )}

      {/* Cancel Local Meeting Confirmation Dialog */}
      {cancelingLocal && (
        <Dialog open onOpenChange={open => { if (!open) setCancelingLocal(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel Meeting?</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel and remove "{cancelingLocal.title}" scheduled on {cancelingLocal.date} at {cancelingLocal.start}–{cancelingLocal.end}?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setCancelingLocal(null)}>
                Keep meeting
              </Button>
              <Button variant="destructive" onClick={() => confirmCancelLocal(cancelingLocal)}>
                Confirm cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Creation Dialogs */}
      {creation?.source==='local' && (
        <MeetingForm open date={creation.date} start={creation.start} onClose={()=>setCreation(null)}/>
      )}

      {creation?.source==='google' && (
        <Dialog open onOpenChange={open=>{if(!open)setCreation(null)}}>
          <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>New Google meeting</DialogTitle>
              <DialogDescription>Review and confirm before sending invitations.</DialogDescription>
            </DialogHeader>
            <GoogleMeetingForm initialDate={creation.date} goal="" onClose={()=>setCreation(null)} onCreated={google.refreshEvents}/>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}
