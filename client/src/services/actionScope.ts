import type { BrowserDatabase } from './browserDatabase.ts'
import type { WidgetBinding } from '../domain/widgetInstances.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageInvestigationService } from './usageInvestigationService.ts'
import { createUsageWorkspaceService } from './usageWorkspaceService.ts'
import { createOverdueReviewService } from './overdueReviewService.ts'
import { usageDraftKey } from '../domain/usageComposition.ts'
import type { Task } from '../domain/types.ts'
export function loadActionScope(database: BrowserDatabase, binding: WidgetBinding): { tasks: Task[]; draft?: { key: string; label: string; fallback: string } } | null {
  if (binding.kind === 'workspace') return { tasks: database.getState().tasks, draft: { key: 'outline', label: 'Preparation outline', fallback: '' } }
  if (binding.kind === 'meeting') {
    const data = createAdaptiveDataService(database).loadPreparation(binding.meetingId)
    if (data.status !== 'found' || data.value.client.id !== binding.clientId || data.value.project.id !== binding.projectId) return null
    return { tasks: data.value.tasks, draft: { key: `meeting-agenda:${binding.meetingId}`, label: 'Meeting agenda', fallback: data.value.meeting.agenda } }
  }
  if (binding.kind === 'usage') {
    const data = createUsageWorkspaceService(database).load(binding.intent)
    return data.status === 'found' ? { tasks: data.value.snapshot.tasks, draft: { key: usageDraftKey(binding.intent), label: 'Investigation notes', fallback: '' } } : null
  }
  if (binding.kind === 'overdue') {
    const data = createOverdueReviewService(database).load(binding.intent, binding.referenceDate)
    return data.status === 'found' ? { tasks: data.value.tasks } : null
  }
  const usage = createUsageInvestigationService(database).load(binding.query)
  const data = createAdaptiveDataService(database).snapshot()
  if (usage.status !== 'found' || !data) return null
  const projects = new Set(usage.value.projects.map(project => project.id))
  const belongs = (task: Task) => data.relationships.some(link => link.sourceKind === 'project' && projects.has(link.sourceId) && link.type === 'related' && link.targetKind === 'task' && link.targetId === task.id) && !data.relationships.some(link => link.sourceKind === 'project' && !projects.has(link.sourceId) && link.targetKind === 'task' && link.targetId === task.id)
  // Manual explorer actions use its saved selection, but it has no established draft.
  return { tasks: data.tasks.filter(belongs) }
}
