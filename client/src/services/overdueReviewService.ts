import { createAdaptiveDataService } from './adaptiveDataService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import { resolvedIntentSchema, intentDateSchema, type ResolvedIntent } from '../domain/intent.ts'
import { adaptiveTaskSchema } from '../domain/adaptiveData.ts'
import { overdueReviewSchema, type OverdueReview } from '../domain/overdueReview.ts'
import { priorityOrder } from '../domain/workspace.ts'
export function createOverdueReviewService(database: BrowserDatabase) {
  const adaptive = createAdaptiveDataService(database)
  return { load(intent: ResolvedIntent, referenceDate: string): LoadResult<OverdueReview> {
    if (!resolvedIntentSchema.safeParse(intent).success || intent.goalType !== 'overdue_review' || !intentDateSchema.safeParse(referenceDate).success) return { status: 'invalid' }
    const data = adaptive.snapshot()
    if (!data || !adaptiveTaskSchema.array().safeParse(data.tasks).success || new Set(data.tasks.map(t => t.id)).size !== data.tasks.length) return { status: 'invalid' }
    const project = data.projects.find(p => p.id === intent.projectId)
    if (!project) return { status: 'missing' }
    const client = data.clients.find(c => c.id === project.clientId) ?? null
    if (intent.clientId && intent.clientId !== client?.id) return { status: 'invalid' }
    const links = data.relationships.filter(l => l.sourceKind === 'project' && l.sourceId === project.id && l.type === 'related')
    const selected = (kind: string, id: string) => links.some(l => l.targetKind === kind && l.targetId === id) && !data.relationships.some(l => l.sourceKind === 'project' && l.sourceId !== project.id && l.targetKind === kind && l.targetId === id)
    const tasks = data.tasks.filter(t => selected('task', t.id) && t.status !== 'completed' && t.due < referenceDate && t.due >= intent.dateRange.from && t.due <= intent.dateRange.to && (!intent.constraints?.status || t.status === intent.constraints.status) && (!intent.constraints?.priority || t.priority === intent.constraints.priority)).sort((a,b) => a.due.localeCompare(b.due) || priorityOrder[a.priority] - priorityOrder[b.priority] || a.id.localeCompare(b.id))
    const resources = data.resources.filter(r => selected('resource', r.id))
    const value = overdueReviewSchema.parse({ project, client, referenceDate, dateRange: intent.dateRange, tasks, resources, relationships: links.filter(l => tasks.some(t => t.id === l.targetId) || resources.some(r => r.id === l.targetId)), reasons: { tasks: `Outstanding tasks explicitly linked to ${project.name}, due before ${referenceDate}.`, resources: `Sources explicitly linked to ${project.name}.` } })
    return { status: 'found', value }
  } }
}
