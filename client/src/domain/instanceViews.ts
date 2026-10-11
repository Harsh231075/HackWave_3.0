import { componentViewSchema, type ComponentView } from './componentIntent.ts'
import { emptyFilters } from './workspace.ts'
import { commitWorkspace, resolveTarget, type WorkspaceDocument } from './workspaceDocument.ts'
import { DEMO_DATE } from '../data/demo.ts'
import { makeInstance, supportsBinding, widgetSelectionKey, type WidgetBinding, type WidgetInstance, type WidgetViewState } from './widgetInstances.ts'

export function instancePlan(instance: WidgetInstance): ComponentView {
  const view = instance.viewState, binding = instance.binding
  return componentViewSchema.parse({ action: 'view', widgets: [instance.widgetType], bindings: { ...view, category: view.calendarCategory, ...(binding.kind === 'workspace' ? { projectId: binding.projectId, clientId: binding.clientId, draftKey: binding.draftKey } : {}) }, reply: 'Saved view', referenceDate: view.referenceDate ?? (binding.kind === 'overdue' ? binding.referenceDate : DEMO_DATE), timezone: view.timezone ?? 'Asia/Kolkata' })
}
export function applyComponentView(document: WorkspaceDocument, view: ComponentView, goal: string, bindingOverride?: WidgetBinding, exactTarget?: string): WorkspaceDocument {
  let active = [...document.active], pins = [...document.pins]
  const targets: string[] = []
  for (const type of view.widgets) {
    const another = /\b(another|second|additional|separate)\b/i.test(goal)
    const selectedExact = exactTarget && [...active, ...pins].find(w => w.instanceId === exactTarget && w.widgetType === type)
    const existing = another ? undefined : resolveTarget({ ...document, active, pins }, selectedExact ? selectedExact.instanceId : type, true)
    const explicitScope = !!view.bindings.projectId || !!view.bindings.clientId || /\b(all projects|all clients|all tasks|workspace tasks)\b/i.test(goal)
    const binding: WidgetBinding = (bindingOverride && supportsBinding(type, bindingOverride.kind) && (bindingOverride.kind !== 'google-calendar' || bindingOverride.mode !== 'browse' || ['calendar', 'meetings', 'availability'].includes(type)) ? bindingOverride : undefined) ?? (explicitScope || !existing ? { kind: 'workspace', projectId: view.bindings.projectId, clientId: view.bindings.clientId, draftKey: view.bindings.draftKey } : existing.binding)
    const sameScope = existing && JSON.stringify(binding) === JSON.stringify(existing.binding)
    const previous = sameScope ? existing.viewState : undefined
    const { projectId: _project, clientId: _client, draftKey: _draft, category, ...state } = view.bindings
    const changedFilters = Object.fromEntries(Object.entries(state.taskFilters).filter(([key, value]) => value !== emptyFilters()[key as keyof ReturnType<typeof emptyFilters>]))
    const reset = /\b(all tasks|all statuses|reset filters|clear filters|no filters)\b/i.test(goal)
    const viewState: WidgetViewState = { ...previous, ...Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined)), taskFilters: reset ? state.taskFilters : { ...(previous?.taskFilters ?? emptyFilters()), ...changedFilters }, referenceDate: view.referenceDate, timezone: view.timezone, ...(category !== undefined ? { calendarCategory: category } : {}) }
    if (/upcoming|onward|from now/i.test(goal) && state.taskFilters.from && !state.taskFilters.to) { viewState.taskFilters.to = ''; delete viewState.dateRange }
    if (reset) { delete viewState.owner; delete viewState.taskStatuses; delete viewState.dateRange }
    if ((changedFilters.status || /all statuses/i.test(goal)) && !state.taskStatuses) delete viewState.taskStatuses
    if (/\b(all owners|everyone)\b/i.test(goal)) delete viewState.owner
    if (/\b(all priorities|any priority)\b/i.test(goal)) viewState.taskFilters.priority = 'all'
    const instance = { ...makeInstance(type, binding, viewState, existing?.instanceId), span: existing?.span ?? 'full', explanation: { type, reason: view.reply, evidence: [] }, label: binding.kind === 'workspace' ? binding.projectId ?? binding.clientId ?? type : existing?.label ?? 'Google Calendar' } satisfies WidgetInstance
    const duplicate = !existing && [...active, ...pins].find(w => widgetSelectionKey(w) === widgetSelectionKey(instance))
    if (duplicate && !another) { targets.push(duplicate.instanceId); continue }
    const pin = pins.find(w => w.instanceId === existing?.instanceId)
    if (pin) pins = pins.map(w => w.instanceId === pin.instanceId ? { ...instance, pinId: pin.pinId, createdAt: pin.createdAt } : w)
    else if (existing) active = active.map(w => w.instanceId === existing.instanceId ? instance : w)
    else active.push(instance)
    targets.push(instance.instanceId)
  }
  return commitWorkspace(document, { active, pins, targets })
}
