import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { calendarDate, type CalendarConnection } from '@/domain/calendar'
import { googleCalendarService } from '@/services/googleCalendarService'
import { GoogleCalendarContext } from './GoogleCalendarContext'
export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<CalendarConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata')
  const [date, setDate] = useState(() => calendarDate(new Date(), timezone))
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setConnection(await googleCalendarService.status()); setError('') }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to check your calendar connection.') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { const controller = new AbortController(); void googleCalendarService.status(controller.signal).then(setConnection).catch(failure => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Calendar unavailable.') }).finally(() => { if (!controller.signal.aborted) setLoading(false) }); return () => controller.abort() }, [])
  const connect = (write = false) => googleCalendarService.authorize(write)
  const disconnect = async () => { await googleCalendarService.disconnect(); setConnection({ configured: true, connected: false }) }
  return <GoogleCalendarContext.Provider value={{ connection, loading, error, refresh, connect, disconnect, date, setDate, timezone, setTimezone, revision, refreshEvents: () => setRevision(value => value + 1) }}>{children}</GoogleCalendarContext.Provider>
}
