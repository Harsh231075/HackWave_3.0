import { createFileService } from '../../client/src/services/fileService.ts'
import { createProfileService } from '../../client/src/services/profileService.ts'
import { createPluginImportService } from '../../client/src/extensions/external/importService.ts'
import { createCollection } from '../../client/src/services/local/collection.ts'
import { createBrowserDatabase } from '../../client/src/services/browserDatabase.ts'
import { createMemoryStorage } from '../../client/src/services/memoryStorage.ts'
import { emptyRecords, freshLocalData } from '../../client/src/services/localDataService.ts'
import { createTaskService } from '../../client/src/services/taskService.ts'
import { createEventService } from '../../client/src/services/eventService.ts'
import { createNoteService } from '../../client/src/services/noteService.ts'
import { createDraftService } from '../../client/src/services/draftService.ts'
import { createAdaptiveDataService } from '../../client/src/services/adaptiveDataService.ts'
import { createResourceModuleService } from '../../client/src/services/resourceModuleService.ts'
import { createUsageDataService } from '../../client/src/services/usageDataService.ts'
import { createExtensionService } from '../../client/src/extensions/extensionService.ts'
import { createTimerService } from '../../client/src/extensions/quick-timer/timerService.ts'
import { createWorkspaceActionService } from '../../client/src/services/workspaceActionService.ts'
import { createRecommendationService } from '../../client/src/services/recommendationService.ts'
import { createFocusSchedulingService } from '../../client/src/services/focusSchedulingService.ts'
import { createDemoSeedService } from '../../client/src/services/demoSeedService.ts'
import { createPinService } from '../../client/src/services/pinService.ts'
import { createNotificationService } from '../../client/src/services/notificationService.ts'
import { calendarDate } from '../../client/src/domain/calendar.ts'
import { workspaceDocumentSchema } from '../../client/src/domain/workspaceDocument.ts'
import { widgetViewStateSchema } from '../../client/src/domain/widgetInstances.ts'
import { z } from 'zod'
import type { DomainSnapshot } from '../../client/src/domain/types.ts'

export type BackendSnapshot = { revision: number; records: DomainSnapshot; collections: Record<string, unknown>; preferences: Record<string, string> }
export const emptyBackendSnapshot = (): BackendSnapshot => ({ revision: 0, records: emptyRecords(), collections: freshLocalData(), preferences: {} })

export function createBackendServices(snapshot: BackendSnapshot) {
  const memory = createMemoryStorage()
  const database = createBrowserDatabase(memory.storage, emptyRecords(), freshLocalData())
  database.hydrate(snapshot.records, snapshot.collections)
  for (const [key, value] of Object.entries(snapshot.preferences)) memory.storage.writeString(key, value)
  const adaptive = createAdaptiveDataService(database), usage = createUsageDataService(database)
  const extensions = createExtensionService(database)
  const services = {
    files: createFileService(database), profiles: createProfileService(database), plugins: createPluginImportService(database),
    members: createCollection(database, 'members', z.object({ id: z.string().min(1), profileId: z.string().min(1) })),
    tasks: createTaskService(database, () => calendarDate()), events: createEventService(database), notes: createNoteService(database),
    drafts: createDraftService(database), resources: createResourceModuleService(database),
    meetings: adaptive.meetings, communications: adaptive.communications, issues: adaptive.issues, relationships: adaptive.relationships,
    observations: usage.observations, releases: usage.releases, usage,
    extensions, timer: createTimerService(database, extensions), actions: createWorkspaceActionService(database),
    recommendations: createRecommendationService(database, () => calendarDate()), focus: createFocusSchedulingService(database, () => calendarDate()),
    demo: createDemoSeedService(database), pins: createPinService(database), notifications: createNotificationService(database),
    state: {
      writeCollection(key: string, value: unknown) {
        if (key === 'workspaceDocument') value = workspaceDocumentSchema.parse(value)
        else if (key === 'pageViews') value = z.record(z.string(), widgetViewStateSchema).parse(value)
        else throw new Error('This collection cannot be written directly.')
        return database.writeCollection(key, value)
      },
      preference(key: string, value: string) {
        const options: Record<string, string[]> = { 'task-view': ['list', 'kanban'], 'calendar-view': ['month', 'week', 'day', 'agenda'], 'calendar-category': ['all', 'meeting', 'focus', 'class', 'break'] }
        if (!options[key]?.includes(value)) throw new Error('Invalid display preference.')
        return memory.storage.writeString(key, value)
      },
      undo() { database.dispatch({ type: 'undo' }); return { ok: true, value: undefined } },
      dismiss(id: string) { database.dispatch({ type: 'dismiss', id }); return { ok: true, value: undefined } },
      restore(id: string) { database.dispatch({ type: 'restore-dismiss', id }); return { ok: true, value: undefined } },
    },
  }
  const exportSnapshot = (): BackendSnapshot => {
    const { tasks, events, drafts, dismissed, activity } = database.getState()
    const raw = memory.storage.readJson('orlo-browser-db-v2')
    const collections = raw.status === 'found' ? (raw.value as { collections: Record<string, unknown> }).collections : {}
    const preferences = Object.fromEntries(Object.entries(memory.export()).filter(([key]) => ['task-view', 'calendar-view', 'calendar-category'].includes(key)))
    return { revision: snapshot.revision, records: { tasks, events, drafts, dismissed, activity }, collections, preferences }
  }
  return { database, services, exportSnapshot }
}

// Only these methods are callable over HTTP. No arbitrary module/property dispatch.
export const mutationMethods: Record<string, readonly string[]> = {
  files: ['saveEncoded', 'delete'], profiles: ['save', 'create', 'update', 'updateProfile', 'delete'],
  plugins: ['importRecord', 'setEnabled', 'remove'], members: ['create', 'delete'],
  tasks: ['save', 'create', 'update', 'delete', 'toggle'], events: ['save', 'create', 'createWithId', 'update', 'delete'],
  notes: ['create', 'update', 'setPinned', 'duplicate', 'delete'], drafts: ['save', 'delete', 'rename'],
  resources: ['save', 'delete', 'saveDraft'], meetings: ['save', 'create', 'update', 'delete'], communications: ['save', 'create', 'update', 'delete'],
  issues: ['save', 'create', 'update', 'delete'], relationships: ['save', 'create', 'update', 'delete'],
  observations: ['save', 'create', 'update', 'delete'], releases: ['save', 'create', 'update', 'delete'], usage: ['importObservations'],
  extensions: ['setEnabled'], timer: ['start', 'pause', 'resume', 'reset', 'tick'], actions: ['createTask', 'saveTask', 'saveDraft'],
  recommendations: ['accept', 'dismiss'], focus: ['schedule'], demo: ['seed'], pins: ['pinWidget', 'unpinWidget', 'updatePinViewState', 'clearPins'],
  notifications: ['create', 'update', 'delete', 'markRead', 'updateSettings'], state: ['writeCollection', 'preference', 'dismiss', 'restore', 'undo'],
}

export function executeMutation(context: ReturnType<typeof createBackendServices>, service: string, method: string, args: unknown[]) {
  if (!mutationMethods[service]?.includes(method)) throw new Error('Unsupported operation.')
  if (service === 'extensions' && ['voice-note'].includes(String(args[0]))) throw new Error('File-dependent extensions are unavailable.')
  const target = context.services[service as keyof typeof context.services] as unknown as Record<string, (...values: unknown[]) => unknown>
  if (typeof target?.[method] !== 'function') throw new Error('Unsupported operation.')
  return target[method](...args)
}
