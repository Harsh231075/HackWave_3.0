import { useUsageScope } from '@/state/UsageScopeContext'
import { usageEvidenceRecords } from '@/domain/usageComposition'
export function UsageSummary() {
  const scope = useUsageScope()
  if (!scope) return null
  const { data, intent } = scope
  return <div className="space-y-3"><h3 className="text-xl font-semibold">{data.project?.name ?? data.client.name}</h3><p className="text-sm text-muted-foreground">{data.client.name} · {intent.dateRange.from} – {intent.dateRange.to} · {intent.constraints?.segment ?? 'All segments'}</p><p className="text-sm">{data.explanation}</p><p className="text-sm text-muted-foreground">{data.releaseExplanation}</p></div>
}
export function UsageEvidence({ widgetId }: { widgetId: string }) {
  const scope = useUsageScope()
  if (!scope) return null
  const widget = scope.composition.widgets.find(w => w.type === widgetId)
  if (!widget) return <p>Pinned by you. Records stay within this usage scope.</p>
  const records = usageEvidenceRecords(scope.data.snapshot)
  return <div className="space-y-2"><p>{widget.reason}</p>{scope.evidenceChanged && <p>Supporting records changed after this layout was created. Inspect the current records below or regenerate the workspace for an updated explanation.</p>}{widget.evidence.map(ref => {
    const source = records.find(r => r.kind === ref.kind && r.record.id === ref.id)
    return <details key={ref.kind + ':' + ref.id}><summary className="cursor-pointer">{source ? ('name' in source.record ? source.record.name : 'title' in source.record ? source.record.title : 'subject' in source.record ? source.record.subject : source.record.date + ' · ' + source.record.segment) : 'Source unavailable'}</summary>{source && <div className="mt-2 space-y-1 text-sm">{'sessions' in source.record ? <p>{source.record.sessions.toLocaleString('en')} sessions · {source.record.source}</p> : <p className="whitespace-pre-wrap">{'body' in source.record ? source.record.body : source.record.description}</p>}{'date' in source.record && <p>{source.record.date}</p>}{'due' in source.record && <p>{source.record.owner} · due {source.record.due} · {source.record.status}</p>}</div>}</details>
  })}</div>
}
