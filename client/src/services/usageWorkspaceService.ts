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
    const value=result.value
    const sources=new Set([...value.releases.map(r=>'release:'+r.id),...value.observations.map(r=>'observation:'+r.id)])
    const relationships=data.relationships.filter(r=>sources.has(r.sourceKind+':'+r.sourceId)&&r.type==='related')
    const linked=(kind:string,id:string)=>relationships.some(r=>r.targetKind===kind&&r.targetId===id)
    const parsed=usageSnapshotSchema.safeParse({query:{dateRange:intent.dateRange,...(intent.constraints?.segment?{segment:intent.constraints.segment}:{})},observations:value.observations,releases:value.releases,relationships,tasks:data.tasks.filter(t=>linked('task',t.id)),resources:data.resources.filter(r=>linked('resource',r.id)),communications:data.communications.filter(r=>linked('communication',r.id)),issues:data.issues.filter(r=>r.status==='open'&&linked('issue',r.id))})
    return parsed.success ? { status: 'found' as const, value: { ...value, snapshot: parsed.data } } : { status: 'invalid' as const }
  } }
}
export type UsageWorkspace = Extract<ReturnType<ReturnType<typeof createUsageWorkspaceService>['load']>, { status: 'found' }>['value']
