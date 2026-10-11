import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { DomainSnapshot } from '../domain/types.ts'
import { persistedSchema } from './workspaceService.ts'
import { noteSchema } from '../domain/notes.ts'
import { meetingSchema, communicationSchema, issueSchema, relationshipSchema, adaptiveResourceSchema } from '../domain/adaptiveData.ts'
import { usageObservationSchema, usageReleaseSchema } from '../domain/usage.ts'
import { createAudioStorage } from '../extensions/voice-note/audioStorage.ts'

export const emptyRecords = (): DomainSnapshot => ({ tasks: [], events: [], drafts: {}, dismissed: [], activity: [] })
export const freshLocalData = () => ({ notes: [], meetings: [], communications: [], issues: [], relationships: [], resources: [], usageObservations: [], usageReleases: [], files: [] })
// Own only these keys. OAuth sessions and unrelated origin storage are preserved.
export const legacyDataKeys = [
  'gogpt-workspace-v1', 'orlo-browser-db-v1', 'gogpt-app-layout-v1', 'orlo-continuous-workspace-v1',
  'gogpt-workspace-layout-v1', 'gogpt-workspace-v1-layout', 'gogpt-workspace-v1-pins',
  'orlo-workspace-conversation-v1', 'orlo-live-calendar-layout-v1', 'orlo-layout-v1', 'orlo-layout-v3',
  'task-view', 'calendar-view', 'calendar-category',
]
const collectionsSchema = z.strictObject({
  version: z.literal(2),
  collections: z.object({
    notes: noteSchema.array(), meetings: meetingSchema.array(), communications: communicationSchema.array(),
    issues: issueSchema.array(), relationships: relationshipSchema.array(), resources: adaptiveResourceSchema.array(),
    usageObservations: usageObservationSchema.array(), usageReleases: usageReleaseSchema.array(), files: z.array(z.unknown()),
  }).catchall(z.unknown()).refine(value => !Object.hasOwn(value, 'projects') && !Object.hasOwn(value, 'clients'), 'Old organizational data is unsupported.'),
})

type State = { status: 'loading' | 'ready' | 'error'; message?: string }
type Result = { ok: boolean; message?: string }
export function createLocalDataService(database: BrowserDatabase, clearAudio = () => createAudioStorage().clear(), beforeReset = () => {}, prepareCanvas = () => {}) {
  let state: State = { status: 'loading' }
  let pending: Promise<Result> | undefined
  const listeners = new Set<() => void>()
  const set = (next: State) => { state = next; listeners.forEach(fn => fn()) }
  const clean = async () => {
    beforeReset()
    await clearAudio()
    for (const key of legacyDataKeys) {
      if (database.storage.remove(key).status !== 'saved') throw new Error('Local storage cleanup failed. Enable device storage and retry.')
    }
    if (database.replaceAll(emptyRecords(), freshLocalData()).status !== 'saved') throw new Error('Local data could not be saved. Enable device storage and retry.')
  }
  const run = (reset: boolean): Promise<Result> => {
    // StrictMode initialization and repeated reset clicks share one cleanup.
    if (pending) return pending
    set({ status: 'loading' })
    pending = (async () => {
      try {
        if (reset) await clean()
        else {
          const records = database.storage.readJson('orlo-data-v2'), collections = database.storage.readJson('orlo-browser-db-v2')
          if (records.status === 'missing' && collections.status === 'missing') await clean()
          else if (records.status !== 'found' || collections.status !== 'found' || !persistedSchema.safeParse(records.value).success || !collectionsSchema.safeParse(collections.value).success) throw new Error('Local data is invalid. Reset local data to recover.')
        }
        // Initialize saved canvas state before any render subscribes to it.
        prepareCanvas()
        set({ status: 'ready' })
        return { ok: true }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Local data cleanup failed. Retry.'
        set({ status: 'error', message })
        return { ok: false, message }
      }
    })().finally(() => { pending = undefined })
    return pending
  }
  return {
    initialize: () => state.status === 'ready' ? Promise.resolve({ ok: true }) : run(false),
    reset: () => run(true),
    getSnapshot: () => state,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
  }
}
