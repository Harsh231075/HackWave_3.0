import { useComponentView } from '@/state/ComponentViewContext'
import { useUsageScope } from '@/state/UsageScopeContext'
import { useEffect, useState } from 'react'
import { useMeetingScope } from '@/hooks/useMeetingScope'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { evidenceRecords } from '@/domain/adaptiveData'

function useEscapeDismiss(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }
    document.addEventListener('keydown', handle, true)
    return () => document.removeEventListener('keydown', handle, true)
  }, [open, close])
}
export function MeetingSummary() {
  const scope = useMeetingScope()
  if (!scope) return null
  const { meeting, client, project, tasks, issues } = scope.data
  return <div className="space-y-3"><h3 className="text-xl font-semibold">{client.name}</h3><p className="text-sm text-muted-foreground">{project.name} · {meeting.date} · {meeting.start}–{meeting.end}</p><p className="text-sm">{client.description}</p><p className="text-sm text-muted-foreground">{tasks.length} linked tasks · {issues.length} open issues</p></div>
}
export function SelectedMeeting() {
  const scope = useMeetingScope()
  if (!scope) return null
  const { meeting, previousMeeting } = scope.data
  return <div className="space-y-4"><div><h3 className="font-medium">{meeting.title}</h3><p className="text-sm text-muted-foreground">{meeting.date} · {meeting.start}–{meeting.end}</p><p className="text-sm">{meeting.participants.join(', ')}</p></div>{previousMeeting && <div className="rounded-md bg-muted p-3"><h4 className="text-sm font-medium">Previous meeting · {previousMeeting.date}</h4><p className="mt-2 whitespace-pre-wrap text-sm">{previousMeeting.agenda}</p></div>}</div>
}
export function MeetingRecordList({ kind }: { kind: 'communications' | 'issues' }) {
  const usage = useUsageScope()
  const meeting = useMeetingScope()
  const component = useComponentView()
  const scope = component ? {data:{communications:component.communications,issues:component.issues,client:{name:component.clients[0]?.name??'Local workspace'}}} : usage ? { data: { ...usage.data.snapshot, client: usage.data.client } } : meeting
  const [selected, setSelected] = useState<string>()
  useEscapeDismiss(!!selected, () => setSelected(undefined))
  if (!scope) return <p className="text-sm text-muted-foreground">Choose a meeting to view these records.</p>
  const records = scope.data[kind]
  const record = records.find(item => item.id === selected)
  return <><div className="space-y-2">{!records.length && <p className="text-sm text-muted-foreground">No matching {kind}.</p>}{records.map(item => <button className="w-full rounded-md border p-3 text-left hover:bg-muted" key={item.id} onClick={() => setSelected(item.id)}><span className="block text-sm font-medium">{'subject' in item ? item.subject : item.title}</span><span className="text-xs text-muted-foreground">{'sender' in item ? `${item.sender} · ${item.date}` : `${item.owner} · ${item.status}`}</span></button>)}</div><Dialog open={!!record} onOpenChange={open => { if (!open) setSelected(undefined) }}><DialogContent onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSelected(undefined) } }}><DialogHeader><DialogTitle>{record && ('subject' in record ? record.subject : record.title)}</DialogTitle><DialogDescription>Synthetic source · {scope.data.client.name}</DialogDescription></DialogHeader><p className="whitespace-pre-wrap text-sm">{record && ('body' in record ? record.body : record.description)}</p></DialogContent></Dialog></>
}
export const Communications = () => <MeetingRecordList kind="communications" />
export const Issues = () => <MeetingRecordList kind="issues" />
export function MeetingEvidence({ widgetId }: { widgetId: string }) {
  const scope = useMeetingScope()
  const [selected, setSelected] = useState<string>()
  useEscapeDismiss(!!selected, () => setSelected(undefined))
  if (!scope) return null
  const widget = scope.composition.widgets.find(item => item.type === widgetId)
  if (!widget) return <p>Pinned by you. Records remain scoped to {scope.data.client.name} and this meeting.</p>
  const records = evidenceRecords(scope.data)
  const item = records.find(item => `${item.kind}:${item.record.id}` === selected)
  return <><p>{widget.reason}</p><div className="mt-2 flex flex-wrap gap-2">{widget.evidence.map(reference => {
    const source = records.find(item => item.kind === reference.kind && item.record.id === reference.id)
    return <Button variant="outline" size="sm" key={`${reference.kind}:${reference.id}`} onClick={() => setSelected(`${reference.kind}:${reference.id}`)} disabled={!source}>{source ? ('title' in source.record ? source.record.title : 'name' in source.record ? source.record.name : 'subject' in source.record ? source.record.subject : 'Source') : 'Source unavailable'}</Button>
  })}</div><Dialog open={!!item} onOpenChange={open => { if (!open) setSelected(undefined) }}><DialogContent onKeyDownCapture={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSelected(undefined) } }}><DialogHeader><DialogTitle>Supporting record</DialogTitle><DialogDescription>{item?.kind} · synthetic data</DialogDescription></DialogHeader><div className="max-h-80 space-y-3 overflow-auto text-sm">{item && <><h3 className="font-medium">{'title' in item.record ? item.record.title : 'name' in item.record ? item.record.name : item.record.subject}</h3><p className="whitespace-pre-wrap">{'agenda' in item.record ? item.record.agenda : 'body' in item.record ? item.record.body : item.record.description}</p>{'date' in item.record && <p className="text-muted-foreground">{item.record.date}{'start' in item.record ? ` · ${item.record.start}–${item.record.end}` : ''}</p>}{'due' in item.record && <p className="text-muted-foreground">{item.record.owner} · due {item.record.due} · {item.record.status}</p>}</>}</div></DialogContent></Dialog></>
}
