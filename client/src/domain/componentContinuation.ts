import type { IntentChanges } from './intentChanges.ts'
import type { ViewBindings } from './componentIntent.ts'
import { emptyFilters } from './workspace.ts'

export function mergeComponentBindings(previous: ViewBindings, changes: IntentChanges): ViewBindings {
  const bindings = structuredClone(previous)
  const filters = { ...emptyFilters(), ...bindings.taskFilters }
  const defaults = emptyFilters()
  for (const [field, patch] of Object.entries(changes)) {
    if (field === 'segment' || field === 'meetingId') throw new Error('Use the adaptive workflow to change the meeting or usage segment.')
    if (['status', 'priority', 'query', 'sort', 'from', 'to'].includes(field)) {
      Object.assign(filters, { [field]: patch.operation === 'set' ? patch.value : defaults[field as keyof typeof defaults] })
      if (field === 'status' && !changes.taskStatuses) delete bindings.taskStatuses
      if (field === 'from' || field === 'to') delete bindings.dateRange
    } else if (patch.operation === 'clear') Reflect.deleteProperty(bindings, field)
    else Object.assign(bindings, { [field]: patch.value })
  }
  if (changes.dateRange) {
    filters.from = bindings.dateRange?.from ?? ''
    filters.to = bindings.dateRange?.to ?? ''
    if (bindings.dateRange) bindings.selectedDate = bindings.dateRange.from
  }
  bindings.taskFilters = filters
  return bindings
}
