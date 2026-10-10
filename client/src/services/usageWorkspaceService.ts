import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { createUsageInvestigationService } from './usageInvestigationService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { usageSnapshotSchema } from '../domain/usageComposition.ts'
import type { ResolvedIntent } from '../domain/intent.ts'
export function createUsageWorkspaceService(database: BrowserDatabase) {
  const usage = createUsageInvestigationService(database), adaptive = createAdaptiveDataService(database)
  return { load(intent: ResolvedIntent) {
    const result = usage.loadIntent(intent)
    if (result.status !== 'found') return result
    const data = adaptive.snapshot()
    if (!data) return { status: 'invalid' as const }
    const value = result.value, ids = new Set(value.projects.map(p => p.id))
    const relationships = data.relationships.filter(r => r.sourceKind === 'project' && ids.has(r.sourceId) && r.type === 'related')
    const belongs = (kind: 'task' | 'resource', id: string) => relationships.some(r => r.targetKind === kind && r.targetId === id) && !data.relationships.some(r => r.sourceKind === 'project' && !ids.has(r.sourceId) && r.targetKind === kind && r.targetId === id)
    const within = (record: { clientId: string; projectId: string; date: string }) => record.clientId === intent.clientId && ids.has(record.projectId) && record.date >= intent.dateRange.from && record.date <= intent.dateRange.to
    const parsed = usageSnapshotSchema.safeParse({ query: { clientId: intent.clientId, ...(intent.projectId ? { projectId: intent.projectId } : {}), dateRange: intent.dateRange, ...(intent.constraints?.segment ? { segment: intent.constraints.segment } : {}) }, client: value.client, projects: value.projects, observations: value.observations, releases: value.releases, relationships,
      tasks: data.tasks.filter(t => belongs('task', t.id)), resources: data.resources.filter(r => belongs('resource', r.id)), communications: data.communications.filter(within), issues: data.issues.filter(r => r.status === 'open' && r.clientId === intent.clientId && ids.has(r.projectId)) })
    return parsed.success ? { status: 'found' as const, value: { ...value, snapshot: parsed.data } } : { status: 'invalid' as const }
  } }
}
export type UsageWorkspace = Extract<ReturnType<ReturnType<typeof createUsageWorkspaceService>['load']>, { status: 'found' }>['value']
