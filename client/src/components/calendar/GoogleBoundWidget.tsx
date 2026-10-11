import { useEffect, useState } from 'react'
import type { WidgetInstance } from '@/domain/widgetInstances'
import { calendarWindow, type CalendarEvent } from '@/domain/calendar'
import { googleCalendarService } from '@/services/googleCalendarService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { GoogleCalendarWidget, GoogleEventDetails } from './GoogleCalendarWidgets'
import { GoogleAvailabilityPanel } from './GoogleAvailabilityPanel'
import { GoogleMeetingForm } from './GoogleMeetingForm'
import { DraftEditor } from '@/components/resources/DraftEditor'
import { Button } from '@/components/ui/button'

export function GoogleBoundWidget({ instance, update }: { instance: WidgetInstance; update: (instance: WidgetInstance) => void }) {
  const calendar = useGoogleCalendar()
  const binding = instance.binding
  const [snapshot, setSnapshot] = useState<{ key: string; events: CalendarEvent[]; event: CalendarEvent | null; error: string } | null>(null)
  const accountId = binding.kind === 'google-calendar' ? binding.accountId : ''
  const eventId = binding.kind === 'google-calendar' ? binding.eventId : undefined
  const prepare = binding.kind === 'google-calendar' && binding.mode === 'prepare'
  const goal = instance.viewState.goal ?? 'Prepare for this meeting'
  const key = `${accountId}:${eventId}:${calendar.date}:${calendar.timezone}:${calendar.revision}:${goal}`
  useEffect(() => {
    if (!prepare || accountId !== calendar.connection?.accountId || !calendar.connection?.connected) return
    const controller = new AbortController()
    const load = async () => {
      try {
        if (eventId) {
          const result = await googleCalendarService.prepare(eventId, goal, controller.signal)
          if (!controller.signal.aborted && result.accountId === accountId) setSnapshot({ key, events: [], event: result.event, error: '' })
        } else {
          const window = calendarWindow(calendar.date, calendar.timezone)
          const result = await googleCalendarService.events(window.from, window.to, calendar.timezone, controller.signal)
          if (!controller.signal.aborted && result.accountId === accountId) setSnapshot({ key, events: result.events, event: null, error: '' })
        }
      } catch (failure) { if (!controller.signal.aborted) setSnapshot({ key, events: [], event: null, error: failure instanceof Error ? failure.message : 'Calendar unavailable.' }) }
    }
    void load()
    return () => controller.abort()
  }, [prepare, accountId, eventId, calendar.connection?.connected, calendar.connection?.accountId, calendar.date, calendar.timezone, calendar.revision, goal, key])
  const loading = prepare && snapshot?.key !== key
  const events = snapshot?.key === key ? snapshot.events : []
  const event = snapshot?.key === key ? snapshot.event : null
  const error = snapshot?.key === key ? snapshot.error : ''
  if (binding.kind !== 'google-calendar') return null
  if (instance.widgetType === 'calendar' || binding.mode === 'browse' && instance.widgetType === 'meetings') return <GoogleCalendarWidget />
  if (instance.widgetType === 'availability') return <GoogleAvailabilityPanel />
  if (binding.mode === 'schedule') return <GoogleMeetingForm goal={instance.viewState.goal ?? 'Schedule a meeting'} onClose={() => update({ ...instance, binding: { ...binding, mode: 'browse' } })} onCreated={calendar.refreshEvents} />
  return <div className="space-y-4">
    {loading && <p role="status">Loading meeting…</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!eventId && events.map(item => <Button variant="outline" key={item.id} onClick={() => update({ ...instance, binding: { ...binding, eventId: item.id } })}>{item.title}</Button>)}
    {!loading && !eventId && !events.length && <p>No meetings on this date.</p>}
    {event && instance.widgetType !== 'outline' && <GoogleEventDetails event={event} />}
    {event && instance.widgetType !== 'context' && <DraftEditor draftKey={`google-preparation:${accountId}:${binding.calendarId}:${event.id}`} label="Meeting preparation notes" />}
  </div>
}
