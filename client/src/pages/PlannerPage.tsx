import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Plus, Target, Zap } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { useGoogleEventsWindow } from '@/hooks/useGoogleEventsWindow'
import { calendarDate, shiftDate } from '@/domain/calendar'
import { GoogleEventDetails } from '@/components/calendar/GoogleCalendarWidgets'
import { googleCalendarService } from '@/services/googleCalendarService'
import { createPlannerSchedulingService } from '@/services/plannerSchedulingService'
import { plannerSummary, slotConflicts } from '@/domain/plannerTime'
import { projectGoogleEvents } from '@/domain/meetingCalendar'
import { minutes } from '@/domain/workspace'
import { availabilityService, browserDatabase } from '@/services'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MeetingDetails, MeetingForm } from '@/components/calendar/CalendarWidgets'
import type { Task } from '@/domain/types'

export function PlannerPage() {
  const { state, selectedDate, selectDate, notify } = useWorkspace()
  const google = useGoogleCalendar()
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: string; end: string } | null>(null)
  const [creatingBlock, setCreatingBlock] = useState<{ start?: string } | null>(null)
  const [selectedGoogleAccount, setSelectedGoogleAccount] = useState<string>()
  const openEvent = (id: string) => { setSelectedGoogleAccount(google.connection?.accountId); setSelectedEventId(id) }
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [schedulingError, setSchedulingError] = useState('')
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const current = useRef({date:selectedDate,task:schedulingTask,block:creatingBlock,connection:google.connection,mounted:true})
  useEffect(() => { current.current={date:selectedDate,task:schedulingTask,block:creatingBlock,connection:google.connection,mounted:true}; return () => { current.current.mounted=false } },[selectedDate,schedulingTask,creatingBlock,google.connection])
  const scheduling = () => createPlannerSchedulingService(browserDatabase,(from,to,zone)=>googleCalendarService.events(from,to,zone),()=>current.current.connection)

  const today = calendarDate()
  const dateObj = parseISO(selectedDate)

  // Remote Google events for this day
  const remote = useGoogleEventsWindow(selectedDate, selectedDate, google.connection?.connected, timezone)
  const projectedGoogle = projectGoogleEvents(remote.events, selectedDate, selectedDate, timezone)

  // Local events on selected date
  const localEvents = state.events.filter(e => e.date === selectedDate)

  // Combined events for display & gap calculations
  const allDayEvents = [...localEvents, ...projectedGoogle].sort((a, b) => a.start.localeCompare(b.start))

  const focusEvents = allDayEvents.filter(e => e.category === 'focus')

  const summary = plannerSummary(localEvents, remote.events, selectedDate, timezone)
  const totalMeetingMinutes = summary.meetingMinutes
  const totalFocusMinutes = summary.focusMinutes
  const freeWorkMinutes = summary.freeMinutes
  const calendarReady = !google.loading && !google.error && (!google.connection?.connected || (!remote.loading && !remote.error))

  // Pending tasks
  const pendingTasks = state.tasks.filter(t => t.status === 'pending')

  // Find free slots for the currently selected task to schedule
  const taskDuration = schedulingTask?.duration ?? 45
  const availableSlots = schedulingTask && calendarReady ? availabilityService.findSlots({
    date: selectedDate,
    duration: taskDuration,
    from: '09:00',
    to: '18:00',
    step: 15,
  }).filter(slot => !slotConflicts(remote.events, selectedDate, slot.start, slot.end, timezone)) : []

  async function scheduleFocusForTask(task: Task, slot: { start: string; end: string }) {
    if (!calendarReady || saving) return
    setSaving(true); setSchedulingError('')
    try {
      const result = await scheduling().schedule(task,selectedDate,slot,timezone,()=>current.current.mounted && current.current.date===selectedDate && current.current.task===task)
      notify(`Focus scheduled for "${task.title}" at ${result.start}–${result.end}.`)
      setSchedulingTask(null); setSelectedSlot(null)
    } catch (error) { if (current.current.mounted) {setSchedulingError(error instanceof Error ? error.message : 'Unable to verify availability.'); google.refreshEvents()} }
    finally { if(current.current.mounted)setSaving(false) }
  }

  // Generate hourly blocks from 08:00 to 18:00
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

  return (
    <main id="main-content" className="shared-page-content space-y-6" tabIndex={-1}>
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Day Planner</h1>
          <p className="text-sm text-muted-foreground">
            Daily timeline of meetings and tasks. Schedule focus blocks directly into free time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">

          <Button size="sm" disabled={!calendarReady || saving} onClick={() => setCreatingBlock({ start: '10:00' })}>
            <Plus size={14} className="mr-1.5" /> Add work block
          </Button>
        </div>
      </header>

      {/* Date Navigation & Summary Stats Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={() => selectDate(shiftDate(selectedDate, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </Button>
          <input
            type="date"
            aria-label="Selected date"
            value={selectedDate}
            onChange={e => { if (e.target.value) selectDate(e.target.value) }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-semibold text-foreground"
          />
          <Button variant="ghost" size="icon-sm" onClick={() => selectDate(shiftDate(selectedDate, 1))} aria-label="Next day">
            <ChevronRight size={16} />
          </Button>
          <Button variant={selectedDate === today ? 'secondary' : 'outline'} size="sm" onClick={() => selectDate(today)}>
            Today
          </Button>
          <Button variant={selectedDate === shiftDate(today, 1) ? 'secondary' : 'outline'} size="sm" onClick={() => selectDate(shiftDate(today, 1))}>
            Tomorrow
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5" title="Meeting busy time within 09:00–18:00; overlapping periods count once">
            <CalendarDays size={15} className="text-blue-500" />
            <span>{calendarReady ? `${(totalMeetingMinutes / 60).toFixed(1)}h` : '—'} Meetings</span>
          </div>
          <div className="flex items-center gap-1.5" title="Scheduled deep work / focus time">
            <Zap size={15} className="text-emerald-500" />
            <span>{(totalFocusMinutes / 60).toFixed(1)}h Focus planned</span>
          </div>
          <div className="flex items-center gap-1.5" title="Free gaps in working hours (9am - 6pm)">
            <Clock3 size={15} className="text-amber-500" />
            <span>{calendarReady ? `${(freeWorkMinutes / 60).toFixed(1)}h` : '—'} Open time</span>
          </div>
          <div className="flex items-center gap-1.5" title="Tasks awaiting schedule">
            <Target size={15} className="text-violet-500" />
            <span>{pendingTasks.length} Pending tasks</span>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{timezone} · Working hours 09:00–18:00 · Focus blocks save locally.{remote.refreshedAt ? ` Google last synced ${new Date(remote.refreshedAt).toLocaleTimeString()}.` : ''}</p>
      {(google.loading || remote.loading) && <p role="status" className="text-sm text-muted-foreground">Checking calendar availability…</p>}
      {(remote.error || google.error) && <div className="rounded-lg border border-destructive p-3"><p role="alert">{remote.error || google.error} · Availability is unavailable until calendars can be verified. Any displayed Google records are the last successful snapshot.</p><Button size="sm" variant="outline" onClick={()=>{google.refreshEvents();void google.refresh()}}>Retry calendars</Button></div>}
      {notice && (
        <div role="status" className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
          <span>{notice}</span>
          <Button variant="ghost" size="sm" onClick={() => setNotice('')}>Dismiss</Button>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Daily Timeline (7 cols) */}
        <section aria-label="Day schedule timeline" className="rounded-xl border border-border bg-card p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">
              Daily Timeline · {format(dateObj, 'EEEE, MMM d')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {allDayEvents.length} events · Click an open slot to schedule focus
            </span>
          </div>

          <div className="mb-3 space-y-2" aria-label="All-day and outside-hours events">{allDayEvents.filter(event => ('allDay' in event && event.allDay) || Number(event.start.slice(0,2))<8 || Number(event.start.slice(0,2))>=18).map(event=><button key={event.id} className="block w-full rounded-lg border p-3 text-left text-sm" onClick={()=>setSelectedEventId(event.id)}>{event.title} · {'allDay' in event && event.allDay ? 'All day' : `${event.start}–${event.end}`}</button>)}</div>
          <div className="space-y-1">
            {hours.map(hour => {
              const hourLabel = `${String(hour).padStart(2, '0')}:00`
              const nextHour = `${String(hour + 1).padStart(2, '0')}:00`

              // Events starting in this hour
              const startingEvents = allDayEvents.filter(e => !('allDay' in e && e.allDay) && Number(e.start.slice(0, 2)) === hour)
              // Is hour slot occupied by an ongoing event?
              const occupied = allDayEvents.some(
                e => !('transparent' in e && e.transparent) && minutes(e.start) < (hour + 1) * 60 && minutes(e.end) > hour * 60
              )

              return (
                <div key={hour} className="group relative flex min-h-[58px] border-b border-dashed border-border/80 last:border-b-0">
                  {/* Time label */}
                  <div className="w-16 shrink-0 pt-2 text-xs font-mono text-muted-foreground">
                    {hourLabel}
                  </div>

                  {/* Content area */}
                  <div className="flex-1 pb-2 pl-3">
                    {startingEvents.length > 0 ? (
                      <div className="space-y-1.5">
                        {startingEvents.map(event => {
                          const isFocus = event.category === 'focus'
                          const isMeeting = event.category === 'meeting'
                          const durationMin = Math.max(0, minutes(event.end) - minutes(event.start))

                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => openEvent(event.id)}
                              className={`w-full rounded-lg border p-2.5 text-left transition-all hover:ring-1 hover:ring-ring ${
                                isFocus
                                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                                  : isMeeting
                                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-950 dark:text-blue-100'
                                  : 'border-border bg-muted/60 text-foreground'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-xs tracking-tight">
                                  {isFocus ? '🎯 Focus: ' : isMeeting ? '👥 Meeting: ' : ''}
                                  {event.title}
                                </span>
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {event.start}–{event.end} ({durationMin}m)
                                </span>
                              </div>
                              {event.agenda && (
                                <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                                  {event.agenda}
                                </p>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    ) : !occupied && calendarReady ? (
                      <button
                        type="button"
                        onClick={() => setCreatingBlock({ start: hourLabel })}
                        className="flex h-full min-h-[42px] w-full items-center justify-between rounded-md border border-transparent px-3 py-1.5 text-xs text-muted-foreground/60 transition-colors hover:border-dashed hover:border-primary/40 hover:bg-muted/40 hover:text-foreground"
                        title={`Click to schedule focus or block time at ${hourLabel}`}
                      >
                        <span className="italic">Free time gap ({hourLabel} – {nextHour})</span>
                        <span className="opacity-0 transition-opacity group-hover:opacity-100 text-primary font-medium flex items-center gap-1">
                          <Plus size={12} /> Add focus
                        </span>
                      </button>
                    ) : (
                      <div className="h-full min-h-[30px] pt-1 text-xs italic text-muted-foreground/40">
                        {calendarReady ? 'Session continues…' : 'Checking availability…'}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Right Column: Tasks to Schedule (5 cols) */}
        <section aria-label="Unscheduled tasks" className="space-y-4 rounded-xl border border-border bg-card p-5 lg:col-span-5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Unscheduled Tasks</h2>
            <span className="text-xs text-muted-foreground">
              {pendingTasks.length} to schedule
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Schedule dedicated focus sessions in your open calendar slots to make sure priority work gets done around meetings.
          </p>

          <div className="space-y-3">
            {pendingTasks.map(task => {
              // Check if already has a focus session on this day
              const scheduledSession = focusEvents.find(
                e => e.id === `planner-focus:${task.id}:${selectedDate}` || e.title === `Focus: ${task.title.replace(/^Demo ·\s*/i, '')}`
              )

              return (
                <article
                  key={task.id}
                  className="rounded-xl border border-border bg-background p-3.5 shadow-2xs transition-all hover:border-border/80"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {task.title}
                    </h3>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        task.priority === 'urgent'
                          ? 'bg-rose-500/15 text-rose-600'
                          : task.priority === 'high'
                          ? 'bg-amber-500/15 text-amber-600'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>

                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {task.description || 'No description provided.'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                    <span className="text-muted-foreground">
                      ⏱ {task.duration || 45} mins · {task.owner || 'You'}
                    </span>

                    {scheduledSession ? (
                      <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                        <CheckCircle2 size={13} />
                        Scheduled {scheduledSession.start}–{scheduledSession.end}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 text-xs font-medium" disabled={!calendarReady || saving}
                        onClick={() => {
                          setSchedulingError(''); setSchedulingTask(task)
                          setSelectedSlot(null)
                        }}
                      >
                        <Zap size={12} className="mr-1" />
                        Schedule focus
                      </Button>
                    )}
                  </div>
                </article>
              )
            })}

            {!pendingTasks.length && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                <p>No pending tasks found.</p>

              </div>
            )}
          </div>
        </section>
      </div>

      {/* Focus Scheduling Dialog */}
      {schedulingTask && (
        <Dialog open onOpenChange={open => { if (!open && !saving) {setSchedulingTask(null);setSelectedSlot(null)} }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Schedule Focus Session</DialogTitle>
              <DialogDescription>
                Schedule dedicated work for "{schedulingTask.title}" ({taskDuration} min) on {selectedDate}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <label className="block text-xs font-medium text-muted-foreground">
                Available Free Slots on {selectedDate}
              </label>

              {!calendarReady ? <p role="status">Verify calendar availability before choosing a time.</p> : availableSlots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableSlots.map(slot => {
                    const isSelected = selectedSlot?.start === slot.start
                    return (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`flex flex-col items-start rounded-lg border p-2.5 text-left text-xs transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10 text-primary font-semibold ring-1 ring-primary'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <span className="font-mono text-sm">{slot.start} – {slot.end}</span>
                        <span className="text-[10px] text-muted-foreground">{taskDuration} min gap</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-muted p-4 text-center text-xs text-muted-foreground">
                  No free gaps of {taskDuration} minutes found during standard hours (9am–6pm) on this date.
                </p>
              )}

              {selectedSlot && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-800 dark:text-emerald-200">
                  Selected slot: <strong>{selectedSlot.start} – {selectedSlot.end}</strong>. Confirmed slot will be added to your calendar and timeline.
                </div>
              )}
            </div>

            {schedulingError && <p role="alert" className="text-sm text-destructive">{schedulingError}</p>}
            <DialogFooter>
              <Button variant="outline" disabled={saving} onClick={() => {setSchedulingTask(null);setSelectedSlot(null)}}>
                Cancel
              </Button>
              <Button
                disabled={saving || !calendarReady || !selectedSlot || !availableSlots.some(s=>s.start===selectedSlot.start && s.end===selectedSlot.end)}
                onClick={() => {
                  if (selectedSlot) {
                    scheduleFocusForTask(schedulingTask, selectedSlot)
                  }
                }}
              >
                {saving ? 'Checking calendars…' : 'Confirm Focus Time'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Add Block Modal */}
      {creatingBlock && (
        <MeetingForm
          beforeSave={input => scheduling().verify(input,timezone,()=>current.current.mounted && current.current.block===creatingBlock && current.current.date===selectedDate)}
          open
          date={selectedDate}
          start={creatingBlock.start ?? '10:00'}
          onClose={() => setCreatingBlock(null)}
        />
      )}

      {/* Event Details Dialog */}
      {selectedEventId && !selectedEventId.startsWith('google:') && (
        <MeetingDetails
          event={state.events.find(e => e.id === selectedEventId)}
          onClose={() => setSelectedEventId(null)}
        />
      )}
      {selectedEventId?.startsWith('google:') && <Dialog open onOpenChange={open=>{if(!open)setSelectedEventId(null)}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Google meeting details</DialogTitle><DialogDescription>Verified Google Calendar record · {google.timezone}</DialogDescription></DialogHeader>{(()=>{const event=selectedGoogleAccount===google.connection?.accountId ? remote.events.find(e=>selectedEventId===`google:${e.id}:${selectedDate}`) : undefined;return event?<GoogleEventDetails event={event}/>:<p>This event is no longer available in this calendar view. Refresh to check its status.</p>})()}</DialogContent></Dialog>}
    </main>
  )
}
