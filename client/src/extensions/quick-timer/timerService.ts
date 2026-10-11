import type { BrowserDatabase } from '../../services/browserDatabase.ts'
import { validProject } from '../../services/projectOwnership.ts'
import { createCollection } from '../../services/local/collection.ts'
import type { ActionResult } from '../../domain/commands.ts'
import type { ExtensionService } from '../extensionService.ts'
import { timerSchema, timerSessionSchema, type QuickTimerState } from './schema.ts'
export function createTimerService(database: BrowserDatabase, extensions: ExtensionService, now = () => Date.now()) {
  const sessions = createCollection(database, 'timerSessions', timerSessionSchema)
  const fail = (message: string) => ({ ok: false as const, message })
  const get = (): QuickTimerState | null => { const raw = database.readCollection('quickTimer'); const parsed = timerSchema.safeParse(raw.status === 'found' ? raw.value : null); return parsed.success ? parsed.data : null }
  const write = (value: QuickTimerState | null): ActionResult<void> => database.writeCollection('quickTimer', value).status === 'invalid' ? fail('Timer state could not be saved.') : { ok: true, value: undefined }
  const remaining = (timer = get()) => timer ? timer.status === 'running' ? Math.max(0, (timer.endAt ?? now()) - now()) : timer.remainingMs : 0
  const pause = (): ActionResult<void> => { const timer = get(); return timer?.status === 'running' ? write({ ...timer, status: 'paused', remainingMs: remaining(timer), endAt: undefined }) : { ok: true, value: undefined } }
  extensions.beforeDisable(id => { if (id === 'quick-timer') {const result=pause();if(!result.ok)throw new Error(result.message)} })
  return {
    get, remaining, pause, sessions: () => sessions.list(),
    start(projectId: string, durationMinutes = 25, taskId?: string): ActionResult<void> {
      if (!extensions.isEnabled('quick-timer')) return fail('Enable Quick Timer first.')
      if (!validProject(database, projectId)) return fail('Choose an available project.')
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) return fail('Choose 1–180 whole minutes.')
      if (taskId && !database.getState().tasks.some(task => task.id === taskId && task.projectId === projectId)) return fail('Choose a task in this project.')
      const current = get(); if (current && current.status !== 'finished') return fail('Pause and reset the current timer before starting another session.')
      const raw = database.readCollection('quickTimer'); if (raw.status === 'invalid' || raw.status === 'found' && raw.value !== null && !timerSchema.safeParse(raw.value).success) return fail('Saved timer data is invalid and has been preserved.')
      const durationMs = durationMinutes * 60000, startedAt = now()
      return write({ id: crypto.randomUUID(), projectId, taskId, durationMs, remainingMs: durationMs, status: 'running', startedAt, endAt: startedAt + durationMs })
    },
    resume(): ActionResult<void> {
      if (!extensions.isEnabled('quick-timer')) return fail('Enable Quick Timer first.')
      const timer = get(); if (!timer || timer.status !== 'paused' || !validProject(database, timer.projectId)) return fail('No available paused timer.')
      return write({ ...timer, status: 'running', endAt: now() + timer.remainingMs })
    },
    reset: () => write(null),
    tick(): ActionResult<void> {
      const timer = get()
      if (!timer || timer.status !== 'running') return { ok: true, value: undefined }
      if (!extensions.isEnabled('quick-timer')) return pause()
      if (remaining(timer) > 0) return { ok: true, value: undefined }
      return database.transaction(() => {
        if (!sessions.getById(timer.id)) { const saved = sessions.save({ id: timer.id, projectId: timer.projectId, taskId: timer.taskId, durationMs: timer.durationMs, elapsedMs: timer.durationMs, startedAt: timer.startedAt, completedAt: timer.endAt ?? now() }); if (!saved.ok) return saved }
        return write({ ...timer, status: 'finished', remainingMs: 0, endAt: undefined })
      })
    },
  }
}
export type TimerService = ReturnType<typeof createTimerService>
