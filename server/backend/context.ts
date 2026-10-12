import { z } from 'zod'
import { BackendError } from './repository.ts'
import { createBackendServices, type BackendSnapshot } from './services.ts'
import { createAdaptiveDataService } from '../../client/src/services/adaptiveDataService.ts'
import { createUsageWorkspaceService } from '../../client/src/services/usageWorkspaceService.ts'
import { createOverdueReviewService } from '../../client/src/services/overdueReviewService.ts'
import { workspaceDocumentSchema } from '../../client/src/domain/workspaceDocument.ts'
import { resolvedIntentSchema } from '../../client/src/domain/intent.ts'
import { usageDraftKey } from '../../client/src/domain/usageComposition.ts'

// The browser supplies the goal and presentation request; stored records supply all evidence.
export function ownedContext(path: string, raw: unknown, snapshot: BackendSnapshot) {
  const body = z.record(z.string(), z.unknown()).parse(raw)
  const { database, services } = createBackendServices(snapshot)
  const adaptive = createAdaptiveDataService(database)
  const enabled = services.extensions.getSettings().enabled.filter(id => !['voice-note', 'external-plugin'].includes(id))
  const canvas = workspaceDocumentSchema.safeParse(snapshot.collections.workspaceDocument)
  if (path === '/api/workspace/resolve') return { ...body, enabledExtensions: enabled,
    instances: canvas.success ? [...canvas.data.active, ...canvas.data.pins.map(pin => ({ ...pin, pinned: true }))] : [],
    lastTargetIds: canvas.success ? canvas.data.targets : [],
    catalog: { tasks: snapshot.records.tasks.map(({ id, title }) => ({ id, title })), owners: [...new Set(snapshot.records.tasks.map(t => t.owner))], draftKeys: Object.keys(snapshot.records.drafts), topics: [...new Set(services.resources.resources.list().map(r => r.context))], externalPlugins: [] },
  }
  if (path === '/api/intent') {
    const candidates = adaptive.loadCandidates(), usage = services.usage.loadCatalog()
    if (candidates.status !== 'found' || usage.status !== 'found') throw new BackendError(400, 'Records could not be read.')
    return { ...body, candidates: { ...candidates.value, usageScopes: [usage.value] } }
  }
  if (path === '/api/workspace/compose') {
    const intent = resolvedIntentSchema.parse(body.intent)
    if (body.kind === 'usage') {
      const data = createUsageWorkspaceService(database).load(intent)
      if (data.status !== 'found') throw new BackendError(404, 'Usage scope is unavailable.')
      return { ...body, snapshot: data.value.snapshot, draft: snapshot.records.drafts[usageDraftKey(intent)] ?? '' }
    }
    if (body.kind === 'overdue') {
      const referenceDate = z.iso.date().parse((body.review as { referenceDate?: unknown })?.referenceDate)
      const review = createOverdueReviewService(database).load(intent, referenceDate)
      if (review.status !== 'found') throw new BackendError(404, 'Review scope is unavailable.')
      return { ...body, review: review.value }
    }
    const data = adaptive.loadPreparation(intent.meetingId ?? '')
    if (data.status !== 'found') throw new BackendError(404, 'Meeting is unavailable.')
    return { ...body, preparation: data.value, agenda: snapshot.records.drafts[`meeting-agenda:${intent.meetingId}`] ?? data.value.meeting.agenda }
  }
  return { ...body, enabledExtensions: enabled, externalPlugins: [], context: { ...snapshot.records, resources: services.resources.resources.list(), usage: services.usage.loadCatalog(), pins: canvas.success ? canvas.data.pins : [], components: canvas.success ? canvas.data.active : [] } }
}
