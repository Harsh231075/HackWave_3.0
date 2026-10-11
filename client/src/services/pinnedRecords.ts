import { loadActionScope } from './actionScope.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageWorkspaceService } from './usageWorkspaceService.ts'
import { createUsageInvestigationService } from './usageInvestigationService.ts'
import { createOverdueReviewService } from './overdueReviewService.ts'
import { fingerprint, type PinnedWidget } from '../domain/widgetInstances.ts'
import { usageSnapshotFingerprint } from '../domain/usageComposition.ts'
import type { LoadResult } from './contracts.ts'
export function loadPinnedRecords(database: BrowserDatabase, pin: Pick<PinnedWidget, 'binding' | 'viewState' | 'widgetType'>): LoadResult<{ fingerprint: string; label: string }> {
  const binding = pin.binding
  if (binding.kind === 'meeting') {
    const result = createAdaptiveDataService(database).loadPreparation(binding.meetingId)
    if (result.status !== 'found') return result
    const { client, project, meeting } = result.value
    if (client.id !== binding.clientId || project.id !== binding.projectId) return { status: 'missing' }
    return { status: 'found', value: { fingerprint: fingerprint(result.value), label: `${client.name} · ${meeting.title}` } }
  }
  if (binding.kind === 'usage') {
    const result = createUsageWorkspaceService(database).load(binding.intent)
    return result.status !== 'found' ? result : { status: 'found', value: { fingerprint: usageSnapshotFingerprint(result.value.snapshot), label: `${result.value.client.name} · ${result.value.project?.name ?? 'All projects'} · ${binding.intent.constraints?.segment ?? 'All segments'} · ${binding.intent.dateRange.from}–${binding.intent.dateRange.to}` } }
  }
  if (binding.kind === 'usage-query') {
    const result = createUsageInvestigationService(database).load(binding.query)
    return result.status !== 'found' ? result : { status: 'found', value: { fingerprint: fingerprint(result.value), label: `${result.value.client.name} · ${result.value.project?.name ?? 'All projects'} · ${binding.query.segment ?? 'All segments'} · ${binding.query.dateRange ? binding.query.dateRange.from + '–' + binding.query.dateRange.to : 'All dates'}` } }
  }
  if (binding.kind === 'overdue') {
    const result = createOverdueReviewService(database).load(binding.intent, binding.referenceDate)
    return result.status !== 'found' ? result : { status: 'found', value: { fingerprint: fingerprint(result.value), label: `${result.value.project.name} · ${binding.intent.dateRange.from}–${binding.intent.dateRange.to}` } }
  }
  if (binding.kind === 'google-calendar') return { status: 'found', value: { fingerprint: fingerprint(binding), label: 'Google Calendar · ' + binding.accountId } }
  const scope = loadActionScope(database, binding)
  if (!scope) return { status: 'missing' }
  const { events, drafts } = database.getState()
  const tasks = scope.tasks
  return { status: 'found', value: { fingerprint: fingerprint({ tasks, events, drafts }), label: pin.viewState.selectedDate && ['calendar', 'timeline', 'availability', 'meetings'].includes(pin.widgetType) ? `Workspace · ${pin.viewState.selectedDate}` : binding.projectId ?? binding.clientId ?? 'All workspace records' } }
}
