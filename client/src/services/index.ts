import { authClient } from '../lib/authClient'
import { googleCalendarService } from './googleCalendarService'
import { createResourceModuleService } from './resourceModuleService'

import { calendarDate } from '../domain/calendar.ts'
import { createWorkspaceActionService } from './workspaceActionService'
import { createPinService } from './pinService'
import { createUsageWorkspaceService } from './usageWorkspaceService'
import { createUsageCompositionService } from './usageCompositionService'
import { createUsageDataService } from './usageDataService'
import { createUsageInvestigationService } from './usageInvestigationService'
import { createOverdueReviewService } from './overdueReviewService'
import { createOverdueCompositionService } from './overdueCompositionService'
import { createFocusSchedulingService } from './focusSchedulingService'
import { createIntentService } from './intentService'
import { createMeetingCompositionService } from './meetingCompositionService'
import { createHttpClient } from './api/httpClient'
import { createAdaptiveDataService } from './adaptiveDataService'
import { createFileService } from './fileService'
import { createNotificationService } from './notificationService'
import { createProfileService } from './profileService'
import { createSearchService } from './searchService'
import { createAnalyticsService } from './analyticsService'
import { createRecommendationService } from './recommendationService'
import { createAvailabilityService } from './availabilityService'
import { createActivityService } from './activityService'
import { createDraftService } from './draftService'
import { createEventService } from './eventService'
import { createTaskService } from './taskService'
import { cloudStore, dataStore, remoteService } from './cloudStore'

import { createPreferencesService } from './preferencesService'
import { createGenerationService } from './generationService'
import { createResourceService } from './resourceService'
const storage = dataStore.storage
export const browserDatabase = dataStore
export { cloudStore }
export const localDataService = { reset: cloudStore.reset }
export const workspaceService = {
  load: () => { const { tasks, events, drafts, dismissed, activity } = browserDatabase.getState(); return { status: 'found' as const, value: structuredClone({ tasks, events, drafts, dismissed, activity }) } },
}
const displayPreferences = createPreferencesService(storage)
export const preferencesService = { load: displayPreferences.load, async save(patch: Parameters<typeof displayPreferences.save>[0]) {
  for (const [key, value] of Object.entries(patch)) {
    const name = { taskView: 'task-view', calendarView: 'calendar-view', calendarCategory: 'calendar-category' }[key]
    const result = await cloudStore.mutate('state', 'preference', [name, value]) as { status?: string; ok?: boolean }
    if (result.ok === false || result.status !== 'saved') return { status: 'invalid' as const }
  }
  return { status: 'saved' as const }
} }
export const generationService = createGenerationService(undefined,()=>extensionService.getSettings().enabled,()=>pluginImportService.list().filter(p=>p.enabled).map(p=>({id:p.id,name:p.name,description:p.description})))
const resourceRecords = createResourceService([], browserDatabase)
export const resourceService = { list: resourceRecords.list, getById: resourceRecords.getById }
const resourceModule = remoteService('resources', createResourceModuleService(browserDatabase), ['save', 'delete', 'saveDraft'] as const)
export const resourceModuleService = { ...resourceModule, get files() { return fileService }, resources: resourceService }

export const taskService = remoteService('tasks', createTaskService(browserDatabase, () => calendarDate()), ['save', 'create', 'update', 'delete', 'toggle'] as const)

export const eventService = remoteService('events', createEventService(browserDatabase), ['save', 'create', 'createWithId', 'update', 'delete'] as const)

export const draftService = remoteService('drafts', createDraftService(browserDatabase), ['save', 'delete', 'rename'] as const)

export const activityService = createActivityService(browserDatabase)

export const availabilityService = createAvailabilityService(browserDatabase)

export const recommendationService = remoteService('recommendations', createRecommendationService(browserDatabase, () => calendarDate()), ['accept', 'dismiss'] as const)

export const analyticsService = createAnalyticsService(browserDatabase)

export const searchService = createSearchService(browserDatabase, resourceService)

export const profileService = remoteService('profiles', createProfileService(browserDatabase), ['save', 'create', 'update', 'updateProfile', 'delete'] as const)


export const notificationService = remoteService('notifications', createNotificationService(browserDatabase), ['create', 'update', 'delete', 'markRead', 'updateSettings'] as const)

export const authService = authClient

export const calendarIntegrationService = { google: googleCalendarService }


const fileRecords = createFileService(browserDatabase)
export const fileService = {
  list: fileRecords.list,
  async upload(file: Blob, name: string) {
    if (file.size > 2 * 1024 * 1024) return { ok: false as const, message: 'Attachments must be smaller than 2 MB.' }
    const epoch = browserDatabase.getEpoch()
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (epoch !== browserDatabase.getEpoch()) return { ok: false as const, message: 'Account changed. Upload again.' }
      let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
      return await cloudStore.mutate('files', 'saveEncoded', [{ name, mimeType: file.type, size: file.size, content: btoa(binary) }]) as import('../domain/commands').ActionResult<{ id: string; name: string }>
    } catch { return { ok: false as const, message: 'Unable to upload this attachment.' } }
  },
  async getDownloadUrl(id: string) {
    const epoch = browserDatabase.getEpoch()
    const response = await fetch('/api/files/' + encodeURIComponent(id), { credentials: 'same-origin' })
    if (!response.ok) throw new Error('Unable to download this attachment.')
    const blob = await response.blob()
    if (epoch !== browserDatabase.getEpoch()) throw new Error('Account changed. Download cancelled.')
    return URL.createObjectURL(blob)
  },
  revokeDownloadUrl: fileRecords.revokeDownloadUrl,
  delete: (id: string) => cloudStore.mutate('files', 'delete', [id]),
}

export { createIntentService } from './intentService'
export type { IntentService, IntentResolver } from './intentService'
export type { IntentRequest, IntentResolution, ResolvedIntent, PartialIntent, IntentCandidates } from '../domain/intent'

const adaptiveRecords = createAdaptiveDataService(browserDatabase)
export const meetingService = remoteService('meetings', adaptiveRecords.meetings, ['save', 'create', 'update', 'delete'] as const)
export const communicationService = remoteService('communications', adaptiveRecords.communications, ['save', 'create', 'update', 'delete'] as const)
export const issueService = remoteService('issues', adaptiveRecords.issues, ['save', 'create', 'update', 'delete'] as const)
export const relationshipService = remoteService('relationships', adaptiveRecords.relationships, ['save', 'create', 'update', 'delete'] as const)
export const adaptiveDataService = { ...adaptiveRecords, meetings: meetingService, communications: communicationService, issues: issueService, relationships: relationshipService }
export const candidateCatalogService = { load: adaptiveDataService.loadCandidates }
export const meetingPreparationService = { load: adaptiveDataService.loadPreparation }

export const intentService = createIntentService((input, options) => createHttpClient().requestJson('/api/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: options?.signal }))
export const meetingCompositionService = createMeetingCompositionService()

export const overdueReviewService = createOverdueReviewService(browserDatabase)
export const overdueCompositionService = createOverdueCompositionService()
export const focusSchedulingService = remoteService('focus', createFocusSchedulingService(browserDatabase, () => calendarDate()), ['schedule'] as const)

export const usageDataService = remoteService('usage', createUsageDataService(browserDatabase), ['importObservations'] as const)
export const usageObservationService = remoteService('observations', usageDataService.observations, ['save', 'create', 'update', 'delete'] as const)
export const usageReleaseService = remoteService('releases', usageDataService.releases, ['save', 'create', 'update', 'delete'] as const)
export const usageInvestigationService = createUsageInvestigationService(browserDatabase)

export const usageWorkspaceService = createUsageWorkspaceService(browserDatabase)
export const usageCompositionService = createUsageCompositionService()

export const pinService = remoteService('pins', createPinService(browserDatabase), ['pinWidget', 'unpinWidget', 'updatePinViewState', 'clearPins'] as const)

export const workspaceActionService = remoteService('actions', createWorkspaceActionService(browserDatabase), ['createTask', 'saveTask', 'saveDraft'] as const)

export { makeInstance, instancesFromLayout } from './workspaceDocumentService'

import { createDemoSeedService } from './demoSeedService'
export const demoSeedService = remoteService('demo', createDemoSeedService(browserDatabase), ['seed'] as const)

import { createNoteService } from './noteService'
export const noteService = remoteService('notes', createNoteService(browserDatabase), ['create', 'update', 'setPinned', 'duplicate', 'delete'] as const)

import { createExtensionService } from '../extensions/extensionService'
import { createTimerService } from '../extensions/quick-timer/timerService'
const extensionRecords = createExtensionService(browserDatabase)
export const extensionService = {
  ...extensionRecords,
  async setEnabled(id: import('../extensions/contracts').ExtensionId, enabled: boolean) {
    try { if (!enabled) extensionRecords.checkDisable(id) }
    catch (error) { return { ok: false as const, message: error instanceof Error ? error.message : 'Unable to stop this extension.' } }
    return await cloudStore.mutate('extensions', 'setEnabled', [id, enabled]) as import('../domain/commands').ActionResult<void>
  },
}
export const timerService = remoteService('timer', createTimerService(browserDatabase, createExtensionService(browserDatabase)), ['start', 'pause', 'resume', 'reset', 'tick'] as const)

import { createPluginImportService } from '../extensions/external/importService'
const pluginRecords = createPluginImportService(browserDatabase, plugin => cloudStore.mutate('plugins', 'importRecord', [plugin]) as Promise<import('../domain/commands').ActionResult<import('../extensions/external/importService').ImportedPlugin>>)
export const pluginImportService = remoteService('plugins', pluginRecords, ['setEnabled', 'remove'] as const)
