import { useContext } from 'react'
import { DisplayPreferencesContext } from '@/state/displayPreferencesContext'
import type { CalendarCategory, CalendarView, TaskView } from '@/services/contracts'
export function useDisplayPreferences() {
  const context = useContext(DisplayPreferencesContext)
  if (!context) throw new Error('Display preferences require DisplayPreferencesProvider.')
  return { ...context.preferences,
    setTaskView: (taskView: TaskView) => context.update({ taskView }),
    setCalendarView: (calendarView: CalendarView) => context.update({ calendarView }),
    setCalendarCategory: (calendarCategory: CalendarCategory) => context.update({ calendarCategory }),
  }
}
