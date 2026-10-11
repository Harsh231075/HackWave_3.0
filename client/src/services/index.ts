import { createProjectDataService, freshProjectData, emptyRecords } from './projectDataService'
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
import { createSharingService } from './sharingService'
import { createCalendarIntegrationService } from './calendarIntegrationService'
import { createAuthService } from './authService'
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
import { createBrowserStorage } from './local/browserStorage'
import { createBrowserDatabase } from './browserDatabase'
import { createPreferencesService } from './preferencesService'
import { createGenerationService } from './generationService'
import { createResourceService } from './resourceService'
const storage = createBrowserStorage()
export const browserDatabase = createBrowserDatabase(storage, emptyRecords(), freshProjectData(), true)
export const projectDataService = createProjectDataService(browserDatabase)
export const workspaceService = {
  load: () => { const { tasks, events, drafts, dismissed, activity } = browserDatabase.getState(); return { status: 'found' as const, value: structuredClone({ tasks, events, drafts, dismissed, activity }) } },
  save: (snapshot: import('../domain/types').DomainSnapshot) => { return browserDatabase.replaceRecords(snapshot) },
}
export const preferencesService = createPreferencesService(browserDatabase.storage)
export const generationService = createGenerationService(undefined,()=>extensionService.getSettings().enabled)
export const resourceService = createResourceService([], browserDatabase)

export const taskService = createTaskService(browserDatabase, () => calendarDate())

export const eventService = createEventService(browserDatabase)

export const draftService = createDraftService(browserDatabase)

export const activityService = createActivityService(browserDatabase)

export const availabilityService = createAvailabilityService(browserDatabase)

export const recommendationService = createRecommendationService(browserDatabase, () => calendarDate())

export const analyticsService = createAnalyticsService(browserDatabase)

export const searchService = createSearchService(browserDatabase, resourceService)

export const profileService = createProfileService(browserDatabase)


export const notificationService = createNotificationService(browserDatabase)

export const authService = createAuthService(browserDatabase, profileService)

export const calendarIntegrationService = createCalendarIntegrationService(browserDatabase)

export const sharingService = createSharingService(browserDatabase, profileService)

export const fileService = createFileService(browserDatabase)

export { createIntentService } from './intentService'
export type { IntentService, IntentResolver } from './intentService'
export type { IntentRequest, IntentResolution, ResolvedIntent, PartialIntent, IntentCandidates } from '../domain/intent'

export const adaptiveDataService = createAdaptiveDataService(browserDatabase)
export const projectService = { ...projectDataService.projects,
  create: (input: { name: string; description?: string }) => projectDataService.create(input.name, input.description),
  delete: projectDataService.delete,
}
export const clientService = adaptiveDataService.clients
export const meetingService = adaptiveDataService.meetings
export const communicationService = adaptiveDataService.communications
export const issueService = adaptiveDataService.issues
export const relationshipService = adaptiveDataService.relationships
export const candidateCatalogService = { load: adaptiveDataService.loadCandidates }
export const meetingPreparationService = { load: adaptiveDataService.loadPreparation }

export const intentService = createIntentService((input, options) => createHttpClient().requestJson('/api/intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: options?.signal }))
export const meetingCompositionService = createMeetingCompositionService()

export const overdueReviewService = createOverdueReviewService(browserDatabase)
export const overdueCompositionService = createOverdueCompositionService()
export const focusSchedulingService = createFocusSchedulingService(browserDatabase, () => calendarDate())

export const usageDataService = createUsageDataService(browserDatabase)
export const usageObservationService = usageDataService.observations
export const usageReleaseService = usageDataService.releases
export const usageInvestigationService = createUsageInvestigationService(browserDatabase)

export const usageWorkspaceService = createUsageWorkspaceService(browserDatabase)
export const usageCompositionService = createUsageCompositionService()

export const pinService = createPinService(browserDatabase)

export const workspaceActionService = createWorkspaceActionService(browserDatabase)

export { makeInstance, instancesFromLayout } from './workspaceDocumentService'

export { projectHasClient } from '../domain/projects'
import { createProjectSeedService } from './projectSeedService'
export const projectSeedService = createProjectSeedService(browserDatabase)

import { createNoteService } from './noteService'
export const noteService = createNoteService(browserDatabase)

import { createExtensionService } from '../extensions/extensionService'
import { createTimerService } from '../extensions/quick-timer/timerService'
import { createAudioStorage } from '../extensions/voice-note/audioStorage'
import { createVoiceNoteService } from '../extensions/voice-note/voiceNoteService'
import { createRecordingController } from '../extensions/voice-note/recordingController'
export const extensionService = createExtensionService(browserDatabase)
export const timerService = createTimerService(browserDatabase, extensionService)
export const audioStorage = createAudioStorage()
export const voiceNoteService = createVoiceNoteService(browserDatabase, audioStorage)
export const recordingController = createRecordingController(browserDatabase, extensionService)
let extensionEpoch = browserDatabase.getEpoch()
browserDatabase.subscribe(() => {
  if (extensionEpoch === browserDatabase.getEpoch()) return
  extensionEpoch = browserDatabase.getEpoch()
  recordingController.reset()
  void audioStorage.clear().catch(error => recordingController.reportError(error instanceof Error ? error.message : 'Audio cleanup failed. Retry resetting local data.'))
})
