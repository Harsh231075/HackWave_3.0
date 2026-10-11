import type { BrowserDatabase } from './browserDatabase.ts'
import type { WidgetBinding } from '../domain/widgetInstances.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageInvestigationService } from './usageInvestigationService.ts'
import { createUsageWorkspaceService } from './usageWorkspaceService.ts'
import { createOverdueReviewService } from './overdueReviewService.ts'
import { usageDraftKey } from '../domain/usageComposition.ts'
import type { Task } from '../domain/types.ts'
export function loadActionScope(database: BrowserDatabase, binding: WidgetBinding): { tasks: Task[]; draft?: { key: string; label: string; fallback: string } } | null {
  if (binding.kind === 'gmail') return { tasks: [] }
  if (binding.kind === 'google-calendar') return { tasks: [], ...(binding.eventId ? { draft: { key: `google-preparation:${binding.accountId}:${binding.calendarId}:${binding.eventId}`, label: 'Meeting preparation notes', fallback: '' } } : {}) }
  if (binding.kind === 'workspace') {
    return {tasks:database.getState().tasks,draft:{key:binding.draftKey??'outline',label:'Notes',fallback:''}}
  }
  if (binding.kind === 'meeting') {
    const data = createAdaptiveDataService(database).loadPreparation(binding.meetingId)
    if (data.status !== 'found') return null
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
  const usage=createUsageInvestigationService(database).load(binding.query)
  if(usage.status!=='found')return null
  const data=createAdaptiveDataService(database).snapshot();if(!data)return null
  const ids=new Set([...usage.value.observations.map(r=>'observation:'+r.id),...usage.value.releases.map(r=>'release:'+r.id)])
  return {tasks:data.tasks.filter(t=>data.relationships.some(l=>ids.has(l.sourceKind+':'+l.sourceId)&&l.targetKind==='task'&&l.targetId===t.id))}
}
