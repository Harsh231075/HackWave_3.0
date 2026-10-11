import { useEffect, useState } from 'react'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { googleCalendarService } from '@/services/googleCalendarService'
import { calendarWindow, type CalendarEvent } from '@/domain/calendar'
export function useGoogleEventsWindow(from: string, to: string, enabled = true, timezoneOverride?: string) {
  const calendar = useGoogleCalendar()
  const timezone = timezoneOverride ?? calendar.timezone
  const account = enabled && calendar.connection?.connected ? calendar.connection.accountId : undefined
  const key = `${account}:${from}:${to}:${timezone}`
  const [snapshot, setSnapshot] = useState<{key:string;events:CalendarEvent[];error:string;at:string;revision:number} | null>(null)
  const [loadingKey, setLoadingKey] = useState('')
  useEffect(() => {
    if (!account) return
    const controller = new AbortController()
    setLoadingKey(key)
    void googleCalendarService.events(calendarWindow(from, timezone).from, calendarWindow(to, timezone).to, timezone, controller.signal).then(result => {
      if (!controller.signal.aborted) setSnapshot({key,events:result.accountId === account ? result.events : [],error:result.accountId === account ? '' : 'Calendar account changed. Reconnect.',at:result.refreshedAt,revision:calendar.revision})
    }).catch(error => {
      if (!controller.signal.aborted) setSnapshot(previous => ({key,events:previous?.key === key ? previous.events : [],error:error instanceof Error ? error.message : 'Unable to load your calendar.',at:previous?.key === key ? previous.at : '',revision:calendar.revision}))
    }).finally(() => { if (!controller.signal.aborted) setLoadingKey('') })
    return () => controller.abort()
  }, [account, key, from, to, timezone, calendar.revision])
  const current = snapshot?.key === key ? snapshot : null
  return {events: account ? current?.events ?? [] : [],error:current?.error ?? '',refreshedAt:current?.at ?? '',loading:!!account && (loadingKey === key || !current || current.revision !== calendar.revision)}
}
