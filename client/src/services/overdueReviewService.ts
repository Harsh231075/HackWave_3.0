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
    const tasks = data.tasks.filter(t => t.status !== 'completed' && t.due < referenceDate && t.due >= intent.dateRange.from && t.due <= intent.dateRange.to && (!intent.constraints?.ownerId || t.owner === intent.constraints.ownerId) && (!intent.constraints?.status || t.status === intent.constraints.status) && (!intent.constraints?.priority || t.priority === intent.constraints.priority)).sort((a,b) => a.due.localeCompare(b.due) || priorityOrder[a.priority] - priorityOrder[b.priority] || a.id.localeCompare(b.id))
    const links=data.relationships.filter(l=>l.sourceKind==='task'&&tasks.some(t=>t.id===l.sourceId)&&l.targetKind==='resource'&&l.type==='related')
    const resources=data.resources.filter(r=>links.some(l=>l.targetId===r.id))
    const value=overdueReviewSchema.parse({referenceDate,dateRange:intent.dateRange,tasks,resources,relationships:links,reasons:{tasks:`Outstanding tasks due before ${referenceDate}, matching the selected dates and filters.`,resources:'Sources linked directly to these overdue tasks.'}})
    return { status: 'found', value }
  } }
}
