import { projectHasClient } from '../domain/projects.ts'
import { createUsageDataService } from './usageDataService.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult } from './contracts.ts'
import type { ResolvedIntent } from '../domain/intent.ts'
import { resolvedIntentSchema } from '../domain/intent.ts'
import { usageQuerySchema, type UsageQuery, type UsageComparison, type UsagePeriodComparison } from '../domain/usage.ts'
const dateMilliseconds = (date: string) => Date.parse(`${date}T00:00:00Z`)
const formatNumber = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 1 }).format(value)
export function createUsageInvestigationService(database: BrowserDatabase) {
  const service = createUsageDataService(database)
  function load(query: UsageQuery) {
    const parsed = usageQuerySchema.safeParse(query)
    if (!parsed.success) return { status: 'invalid' as const }
    query = parsed.data
    const data = service.snapshot()
    if (!data) return { status: 'invalid' as const }
    const client = data.clients.find(c => c.id === query.clientId)
    if (query.clientId && !client) return { status: 'missing' as const }
    const project = query.projectId ? data.projects.find(p => p.id === query.projectId) : null
    if (query.projectId && !project) return { status: 'missing' as const }
    if (project && !projectHasClient(project, query.clientId)) return { status: 'invalid' as const }
    const projects = data.projects.filter(p => projectHasClient(p, query.clientId) && (!project || p.id === project.id))
    const owned = data.observations.filter(r => (!query.clientId || r.clientId === query.clientId) && (!project || r.projectId === project.id))
    const availableSegments = [...new Set(owned.map(r => r.segment))].sort()
    const dates = owned.map(r => r.date).sort()
    const range = query.dateRange ?? (dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null)
    const days: string[] = []
    if (range) {
      const count = Math.round((dateMilliseconds(range.to) - dateMilliseconds(range.from)) / 86400000) + 1
      if (count > 366) return { status: 'invalid' as const }
      for (let n = 0; n < count; n++) days.push(new Date(dateMilliseconds(range.from) + n * 86400000).toISOString().slice(0, 10))
    }
    const segments = query.segment ? [query.segment] : availableSegments
    const observations = owned.filter(r => (!range || r.date >= range.from && r.date <= range.to) && (!query.segment || r.segment === query.segment)).sort((a,b) => a.date.localeCompare(b.date) || a.segment.localeCompare(b.segment) || a.projectId.localeCompare(b.projectId))
    const releases = data.releases.filter(r => range && (!query.clientId || r.clientId === query.clientId) && (!project || r.projectId === project.id) && r.date >= range.from && r.date <= range.to && (!query.segment || !r.segments.length || r.segments.includes(query.segment))).sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))

    // Missing project/day/segment observations are unknown, never implied zero.
    const countAt = (date: string, segment: string) => {
      const counts = projects.map(project => { const records = observations.filter(record => record.projectId === project.id && record.date === date && record.segment === segment); return records.length ? records.reduce((sum, record) => sum + record.sessions, 0) : undefined })
      if (!counts.length || counts.some(count => count === undefined)) return null
      const total = counts.reduce<number>((sum,count) => sum + (count ?? 0), 0)
      return Number.isSafeInteger(total) ? total : null
    }
    const series = days.map(date => ({ date, values: Object.fromEntries(segments.map(segment => [segment, countAt(date, segment)])) }))
    const comparisons: UsageComparison[] = range ? segments.map(segment => {
      const baseline = countAt(range.from, segment), current = countAt(range.to, segment)
      const missingDays = days.filter(day => countAt(day,segment) === null).length
      const changePercent = baseline !== null && baseline > 0 && current !== null && range.from !== range.to ? (current - baseline) / baseline * 100 : null
      const comparison = baseline === null || current === null ? 'Endpoint comparison unavailable: one or both dates lack complete measurements.' : range.from === range.to ? `${formatNumber(current)} sessions; select two dates to compare.` : `${formatNumber(baseline)} → ${formatNumber(current)} sessions (${changePercent === null ? 'percentage unavailable: zero baseline' : `${changePercent > 0 ? '+' : ''}${formatNumber(changePercent)}%`}).`
      return { segment, from: range.from, to: range.to, baseline, current, changePercent, missingDays, expectedDays: days.length, explanation: `${segment}: ${comparison}${missingDays ? ` ${missingDays} of ${days.length} days have incomplete measurements.` : ''}` }
    }) : []
    const periodLength = Math.floor(days.length / 2)
    const baselineDays = days.slice(0, periodLength), currentDays = days.slice(days.length - periodLength)
    const periodComparisons: UsagePeriodComparison[] = periodLength ? segments.map(segment => {
      const baselineCounts = baselineDays.map(day => countAt(day, segment)), currentCounts = currentDays.map(day => countAt(day, segment))
      const average = (counts: Array<number | null>) => {
        if (counts.some(count => count === null)) return null
        // Divide before summing to avoid overflowing a valid daily aggregate.
        return counts.reduce<number>((sum, count) => sum + (count ?? 0) / counts.length, 0)
      }
      const baselineAverage = average(baselineCounts), currentAverage = average(currentCounts)
      const changePercent = baselineAverage !== null && baselineAverage > 0 && currentAverage !== null ? (currentAverage - baselineAverage) / baselineAverage * 100 : null
      const missingDays = [...baselineCounts, ...currentCounts].filter(count => count === null).length
      const baselineRange = { from: baselineDays[0], to: baselineDays[periodLength - 1] }, currentRange = { from: currentDays[0], to: currentDays[periodLength - 1] }
      const comparison = missingDays ? 'Comparison unavailable because one or both periods have incomplete measurements.' : formatNumber(baselineAverage!) + ' → ' + formatNumber(currentAverage!) + ' average daily sessions (' + (changePercent === null ? 'percentage unavailable: zero baseline' : (changePercent > 0 ? '+' : '') + formatNumber(changePercent) + '%') + ').'
      return { segment, baselineRange, currentRange, baselineAverage, currentAverage, changePercent, missingDays, explanation: segment + ': ' + comparison + ' Equal ' + periodLength + '-day periods: ' + baselineRange.from + '–' + baselineRange.to + ' versus ' + currentRange.from + '–' + currentRange.to + (days.length % 2 ? '; middle day excluded.' : '.') }
    }) : []
    return { status: 'found' as const, value: { client: client ?? null, project, projects, dateRange: range, availableSegments, segments, observations, releases, series, comparisons, periodComparisons,
      explanation: observations.length ? `Daily sessions for ${project?.name ?? client?.name ?? 'Selected projects'}; comparisons use the first and last selected dates, not period averages.` : 'No usage measurements match this selection.',
      releaseExplanation: releases.length ? `${releases.length} release record${releases.length === 1 ? '' : 's'} fall within the selected dates and segment. Timing alone does not establish causation.` : 'No matching release records in this date range. No release explanation can be inferred.',
    } }
  }
  return { load, loadIntent(intent: ResolvedIntent, segment?: string) {
    if (!resolvedIntentSchema.safeParse(intent).success || intent.goalType !== 'usage_investigation' || !(intent.projectId || intent.clientId)) return { status: 'invalid' as const }
    return load({ clientId: intent.clientId, ...(intent.projectId ? { projectId: intent.projectId } : {}), dateRange: intent.dateRange, ...((segment ?? intent.constraints?.segment) ? { segment: segment ?? intent.constraints?.segment } : {}) })
  } }
}
export type UsageInvestigation = Extract<ReturnType<ReturnType<typeof createUsageInvestigationService>['load']>, { status: 'found' }>['value']
export type UsageResult = LoadResult<UsageInvestigation>
