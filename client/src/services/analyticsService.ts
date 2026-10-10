import type { BrowserDatabase } from './browserDatabase.ts'
import { minutes } from '../domain/workspace.ts'
export function createAnalyticsService(database: BrowserDatabase) {
  const getTaskSummary = ({ from, to }: { from?: string; to?: string } = {}) => {
    const tasks = database.getState().tasks.filter(task => (!from || task.due >= from) && (!to || task.due <= to))
    return { total: tasks.length, completed: tasks.filter(task => task.status === 'completed').length, blocked: tasks.filter(task => task.status === 'blocked').length, open: tasks.filter(task => task.status !== 'completed').length }
  }
  return {
    getTaskSummary,
    getOverview({ from, to }: { from?: string; to?: string } = {}) {
      const events = database.getState().events.filter(event => (!from || event.date >= from) && (!to || event.date <= to))
      return { tasks: getTaskSummary({ from, to }), events: events.length, scheduledMinutes: events.reduce((sum, event) => sum + minutes(event.end) - minutes(event.start), 0) }
    },
  }
}
