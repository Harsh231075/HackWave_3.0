import { calendarDate } from '../domain/calendar.ts'
import { createWorkspaceActionService } from './workspaceActionService'
import { createPinService } from './pinService'
import { createUsageWorkspaceService } from './usageWorkspaceService'
import { createUsageCompositionService } from './usageCompositionService'
import { USAGE_DEMO } from '../data/usageDemo'
import { createUsageDataService } from './usageDataService'
import { createUsageInvestigationService } from './usageInvestigationService'
import { createOverdueReviewService } from './overdueReviewService'
import { createOverdueCompositionService } from './overdueCompositionService'
import { createFocusSchedulingService } from './focusSchedulingService'
import { createIntentService } from './intentService'
import { createMeetingCompositionService } from './meetingCompositionService'
import { createHttpClient } from './api/httpClient'
import { ADAPTIVE_DEMO } from '../data/adaptiveDemo'
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
import { DEMO_DATE, INITIAL_TASKS, INITIAL_EVENTS, INITIAL_DRAFTS, RESOURCES } from '../data/demo'
import { createBrowserStorage } from './local/browserStorage'
import { createBrowserDatabase } from './browserDatabase'
import { createPreferencesService } from './preferencesService'
import { createGenerationService } from './generationService'
import { createResourceService } from './resourceService'
const storage = createBrowserStorage()
export const browserDatabase = createBrowserDatabase(storage, { tasks: INITIAL_TASKS, events: INITIAL_EVENTS, drafts: INITIAL_DRAFTS, dismissed: [], activity: ['Your workspace is ready for the week', 'Demo resources added to your workspace'] }, { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: RESOURCES })
export const workspaceService = {
  load: () => { const { tasks, events, drafts, dismissed, activity } = browserDatabase.getState(); return { status: 'found' as const, value: structuredClone({ tasks, events, drafts, dismissed, activity }) } },
  save: (snapshot: import('../domain/types').DomainSnapshot) => { return browserDatabase.replaceRecords(snapshot) },
}
export const preferencesService = createPreferencesService(browserDatabase.storage)
export const generationService = createGenerationService()
export const resourceService = createResourceService(RESOURCES, browserDatabase)

export const taskService = createTaskService(browserDatabase, () => calendarDate())

export const eventService = createEventService(browserDatabase)

export const draftService = createDraftService(browserDatabase)

export const activityService = createActivityService(browserDatabase)

export const availabilityService = createAvailabilityService(browserDatabase)

export const recommendationService = createRecommendationService(browserDatabase, () => DEMO_DATE)

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
export const projectService = adaptiveDataService.projects
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
