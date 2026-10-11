import { useWidgetSelection } from '@/lib/workspace/WidgetSelectionContext'
import { WidgetCanvasContext } from '@/lib/workspace/WidgetCanvasContext'
import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { format, parseISO } from 'date-fns'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { browserDatabase, usageDataService, usageInvestigationService } from '@/services'
import { createRecordStore } from '@/services/preparationStore'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DataState } from '@/components/feedback/common'
import type { UsageQuery } from '@/domain/usage'
const colors = ['#456a52', '#d6c6a5', '#88a58d', '#b8c5b1']
function UsageSelect({ label, value, items, onChange }: { label: string; value: string; items: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  return <Select items={items} value={value} onValueChange={next => { if (next !== null) onChange(next) }}><SelectTrigger aria-label={label} size="sm" className="w-full min-w-0"><SelectValue placeholder={items.find(item => item.value === value)?.label ?? label} /></SelectTrigger><SelectContent>{items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select>
}
export function DataUsageExplorer({ initialQuery, boundQuery }: { initialQuery?: UsageQuery; boundQuery?: UsageQuery }) {
  const canvas = useContext(WidgetCanvasContext)
  const registerSelection = useWidgetSelection()
  initialQuery = initialQuery ?? canvas?.usageQuery ?? undefined
  const [clientId, setClientId] = useState(initialQuery?.clientId ?? '')
  const [projectId, setProjectId] = useState(initialQuery?.projectId ?? '')
  const [segment, setSegment] = useState(initialQuery?.segment ?? '')
  const [from, setFrom] = useState(initialQuery?.dateRange?.from ?? '')
  const [to, setTo] = useState(initialQuery?.dateRange?.to ?? '')
  const catalogStore = useMemo(() => createRecordStore(browserDatabase, usageDataService.loadCatalog), [])
  const catalog = useSyncExternalStore(catalogStore.subscribe, catalogStore.getSnapshot)
  const selectedClient = clientId || (catalog.status === 'found' ? catalog.value.clients[0]?.id : '') || ''
  const localQuery = useMemo(() => ({ clientId: selectedClient, ...(projectId ? { projectId } : {}), ...(segment ? { segment } : {}), ...(from && to ? { dateRange: { from, to } } : {}) }), [selectedClient, projectId, segment, from, to])
  const query = boundQuery ?? localQuery
  const resultStore = useMemo(() => createRecordStore(browserDatabase, () => usageInvestigationService.load(query)), [query])
  const result = useSyncExternalStore(resultStore.subscribe, resultStore.getSnapshot)
  useEffect(() => {
    if (!boundQuery) registerSelection?.(result.status === 'found' && (!!from === !!to) ? query : null)
  }, [boundQuery, registerSelection, result.status, query, from, to])
  if (catalog.status !== 'found') return <p role="alert" className="text-sm text-muted-foreground">Saved usage data is invalid and has been preserved. Repair the records to view usage.</p>
  if (!catalog.value.clients.length) return <DataState state="empty" empty="Add a client and linked usage measurements to view usage.">{null}</DataState>
  const projects = catalog.value.projects.filter(p => p.clientId === selectedClient)
  const value = result.status === 'found' ? result.value : null
  const chartData = value?.series.map(row => ({ date: row.date, ...Object.fromEntries(value.segments.map((name,index) => [`segment-${index}`, row.values[name]])) })) ?? []
  const dateLabel = value?.dateRange ? `${format(parseISO(value.dateRange.from), 'd MMM yyyy')} – ${format(parseISO(value.dateRange.to), 'd MMM yyyy')}` : 'No measurement dates'
  const partialDate = !boundQuery && (!!from !== !!to)
  return <div className="space-y-4 min-w-0">
    {!boundQuery && <><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <UsageSelect label="Usage client" value={selectedClient} items={catalog.value.clients.map(c => ({ value: c.id, label: c.name }))} onChange={next => { setClientId(next); setProjectId(''); setSegment(''); setFrom(''); setTo('') }} />
      <UsageSelect label="Usage project" value={projectId} items={[{ value: '', label: 'All projects' }, ...projects.map(p => ({ value: p.id, label: p.name }))]} onChange={next => { setProjectId(next); setSegment(''); setFrom(''); setTo('') }} />
      <UsageSelect label="Usage segment" value={segment} items={[{ value: '', label: 'All segments' }, ...(value?.availableSegments ?? []).map(name => ({ value: name, label: name }))]} onChange={setSegment} />
    </div>
    <div className="flex flex-wrap items-end gap-3 text-xs text-muted-foreground"><label>From<input aria-label="Usage from date" className="mt-1 block rounded border bg-background p-2 text-foreground" type="date" max={to || undefined} value={from} onChange={e => setFrom(e.target.value)} /></label><label>Through<input aria-label="Usage through date" className="mt-1 block rounded border bg-background p-2 text-foreground" type="date" min={from || undefined} value={to} onChange={e => setTo(e.target.value)} /></label>{(from || to) && <button type="button" className="p-2 underline" onClick={() => { setFrom(''); setTo('') }}>All measurement dates</button>}</div></>}
    {partialDate ? <p role="status" className="text-sm">Choose both dates to apply a range.</p> : result.status !== 'found' ? <p role="alert" className="text-sm">{result.status === 'missing' ? 'This client or project is no longer available. Choose another selection.' : 'Usage selection is invalid. Choose valid dates within one year or repair saved records.'}</p> : value && <>
      <div><strong>{value.project?.name ?? value.client.name} · daily sessions</strong><p className="text-xs text-muted-foreground">{value.client.name} · {dateLabel}</p></div>
      <DataState state={value.observations.length ? 'ready' : 'empty'} empty="No usage measurements match this selection.">
        <div role="img" aria-label={value.comparisons.map(c => c.explanation).join(' ')} className="min-w-0"><ResponsiveContainer width="100%" height={240}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="var(--border)" /><XAxis dataKey="date" tickFormatter={date => format(parseISO(date), 'd MMM')} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} /><YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} /><Tooltip labelFormatter={date => String(date)} />{value.segments.map((name,index) => <Bar key={name} name={name} dataKey={`segment-${index}`} fill={colors[index % colors.length]} radius={[3,3,0,0]} />)}</BarChart></ResponsiveContainer></div>
        <div className="rounded border bg-muted p-3 text-sm space-y-2" aria-label="Usage findings"><strong>What the records show</strong><p>{value.explanation}</p>{value.comparisons.map(c => <p key={c.segment}>{c.explanation}</p>)}{value.periodComparisons.map(c => <p key={'period-' + c.segment}>{c.explanation}</p>)}<p>{value.releaseExplanation}</p></div>
      </DataState>
      <details className="text-sm"><summary className="cursor-pointer text-primary">Inspect usage records ({value.observations.length})</summary><div className="overflow-x-auto mt-2"><table className="w-full text-left text-xs [&_th]:p-2 [&_td]:p-2 [&_tr]:border-b"><thead><tr><th>Date</th><th>Project</th><th>Segment</th><th>Sessions</th><th>Source</th></tr></thead><tbody>{value.observations.map(record => <tr key={record.id}><td>{record.date}</td><td>{value.projects.find(p => p.id === record.projectId)?.name ?? record.projectId}</td><td>{record.segment}</td><td>{record.sessions.toLocaleString('en')}</td><td>{record.source}</td></tr>)}</tbody></table></div></details>
      <details className="text-sm"><summary className="cursor-pointer text-primary">Inspect release records ({value.releases.length})</summary><div className="space-y-2 mt-2">{value.releases.map(release => <article key={release.id} className="rounded border p-3"><strong>{release.title}</strong><p className="text-xs text-muted-foreground">{release.date} · {value.projects.find(p => p.id === release.projectId)?.name ?? release.projectId} · {release.source}</p><p className="mt-1">{release.description}</p></article>)}{!value.releases.length && <p>No matching release records.</p>}</div></details>
    </>}
  </div>
}
