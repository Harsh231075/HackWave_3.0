import type { BrowserDatabase } from './browserDatabase.ts'
import { prepareFocusTime, type ActionResult } from '../domain/commands.ts'
import type { Event } from '../domain/types.ts'
export function createRecommendationService(database: BrowserDatabase, today: () => string) {
  return {
    list() {
      return structuredClone(database.getState().tasks.filter(task => task.status !== 'completed' && !database.getState().dismissed.includes(`recommendation-${task.id}`)).sort((a, b) => a.due.localeCompare(b.due)).map(task => ({ id: `recommendation-${task.id}`, taskId: task.id, task })))
    },
    accept(taskId: string): ActionResult<Event> {
      const existing = database.getState().events.find(event => event.id === `recommendation-${taskId}`)
      if (existing) return { ok: true, value: structuredClone(existing) }
      const result = prepareFocusTime(taskId, today(), database.getState())
      if (!result.ok) return result
      database.dispatch(result.value.action); return { ok: true, value: structuredClone(result.value.record) }
    },
    dismiss(id: string) { if (!database.getState().dismissed.includes(id)) database.dispatch({ type: 'dismiss', id }) },
  }
}
