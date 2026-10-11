import { usageSnapshotFingerprint } from '@/domain/usageComposition'
import { useMeetingScope } from './useMeetingScope'
import { useUsageScope } from '@/state/UsageScopeContext'
import { useOverdueScope } from '@/state/OverdueScopeContext'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useDisplayPreferences } from './useDisplayPreferences'
import { activeInstanceId, fingerprint, type WidgetBinding, type WidgetInstance } from '@/domain/widgetInstances'
import type { UsageQuery } from '@/domain/usage'
import type { WidgetType } from '@/lib/workspace/config'
import { registry } from '@/lib/workspace/registry'

export function useWidgetInstanceFactory() {
  const meeting = useMeetingScope()
  const usage = useUsageScope()
  const overdue = useOverdueScope()
  const { state, selectedDate } = useWorkspace()
  const preferences = useDisplayPreferences()
  return (type: WidgetType, span: WidgetInstance['span'] = 'full', query?: UsageQuery | null): WidgetInstance | null => {
    let binding: WidgetBinding = { kind: 'workspace' }
    let label: string = type
    let data: unknown = { tasks: state.tasks, events: state.events, drafts: state.drafts }
    if (usage) {
      binding = { kind: 'usage', intent: usage.intent }
      label = `${usage.data.client.name} · ${usage.data.project?.name ?? 'All projects'} · ${usage.intent.constraints?.segment ?? 'All segments'} · ${usage.intent.dateRange.from}–${usage.intent.dateRange.to}`
      data = usage.data.snapshot
    } else if (overdue) {
      binding = { kind: 'overdue', intent: overdue.intent, referenceDate: overdue.data.referenceDate }
      label = `${overdue.data.project.name} · ${overdue.intent.dateRange.from}–${overdue.intent.dateRange.to}`
      data = overdue.data
    } else if (meeting) {
      binding = { kind: 'meeting', meetingId: meeting.data.meeting.id, clientId: meeting.data.client.id, projectId: meeting.data.project.id }
      label = `${meeting.data.client.name} · ${meeting.data.meeting.title}`
      data = meeting.data
    } else if (type === 'usage') {
      if (!query) return null
      binding = { kind: 'usage-query', query }
      label = `${query.clientId} · ${query.projectId ?? 'All projects'} · ${query.segment ?? 'All segments'} · ${query.dateRange ? query.dateRange.from + '–' + query.dateRange.to : 'All dates'}`
    }
    if (!registry[type].supportedBindings.includes(binding.kind)) return null
    const source = (usage ?? overdue ?? meeting)?.composition.widgets.find(w => w.type === type)
    // Composition widgets also contain layout fields; provenance has its own strict contract.
    const explanation = { type, reason: source?.reason ?? registry[type].reason, evidence: source?.evidence ?? [] }
    return {
      instanceId: activeInstanceId(type, binding), widgetType: type, span, binding,
      viewState: {
        taskFilters: { ...(usage?.filters ?? overdue?.filters ?? meeting?.filters ?? state.filters) },
        selectedDate, calendarView: preferences.calendarView, calendarCategory: preferences.calendarCategory,
      },
      explanation, fingerprint: usage ? usageSnapshotFingerprint(usage.data.snapshot) : fingerprint(data), label,
    }
  }
}
export function useWidgetInstance(type: WidgetType, span: WidgetInstance['span'] = 'full', query?: UsageQuery | null) {
  return useWidgetInstanceFactory()(type, span, query)
}
