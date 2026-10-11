import { createContext, useContext } from 'react'
import type { CalendarConnection } from '@/domain/calendar'
export const GoogleCalendarContext = createContext<{
  connection: CalendarConnection | null; loading: boolean; error: string
  date: string; setDate: (date: string) => void; timezone: string; setTimezone: (timezone: string) => void; revision: number; refreshEvents: () => void
  refresh: () => Promise<void>; connect: (write?: boolean) => void; disconnect: () => Promise<void>
} | null>(null)
export function useGoogleCalendar() {
  const value = useContext(GoogleCalendarContext)
  if (!value) throw new Error('Google Calendar requires GoogleCalendarProvider.')
  return value
}
