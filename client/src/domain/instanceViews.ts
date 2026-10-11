import { mergeComponentBindings } from './componentContinuation.ts'
import { componentViewSchema, type ComponentView } from './componentIntent.ts'
import { emptyFilters } from './workspace.ts'
import { commitWorkspace, resolveTarget, type WorkspaceDocument } from './workspaceDocument.ts'
import { DEMO_DATE } from '../data/demo.ts'
import { makeInstance, supportsBinding, widgetSelectionKey, sameBinding, type WidgetBinding, type WidgetInstance, type WidgetViewState } from './widgetInstances.ts'

export function instancePlan(instance: WidgetInstance): ComponentView {
  const view = instance.viewState, binding = instance.binding
  return componentViewSchema.parse({ action: 'view', widgets: [instance.widgetType], bindings: { ...view, category: view.calendarCategory, ...(binding.kind === 'workspace' ? { projectId: binding.projectId, clientId: binding.clientId, draftKey: binding.draftKey } : {}) }, reply: 'Saved view', referenceDate: view.referenceDate ?? (binding.kind === 'overdue' ? binding.referenceDate : DEMO_DATE), timezone: view.timezone ?? 'Asia/Kolkata' })
}
export function applyComponentView(document: WorkspaceDocument, view: ComponentView, goal: string, bindingOverride?: WidgetBinding, exactTarget?: string, projects: Array<{ id: string; clientId?: string }> = []): WorkspaceDocument {
  let active = [...document.active], pins = [...document.pins]
  const targets: string[] = []
  const explicitIds = exactTarget ? [exactTarget] : view.continuation?.targetInstanceIds ?? []
  if (explicitIds.some(id => ![...active, ...pins].some(w => w.instanceId === id))) throw new Error('This view is no longer available. Choose another view.')
  if (!exactTarget && !/\b(pinned|pin)\b/i.test(goal) && explicitIds.some(id => pins.some(pin => pin.instanceId === id))) throw new Error('Name the pinned view explicitly before changing it.')
  const requests = view.widgets.flatMap(type => {
    const matching = explicitIds.filter(id => [...active, ...pins].some(w => w.instanceId === id && w.widgetType === type))
    return (matching.length ? matching : [undefined]).map(requestedTarget => ({ type, requestedTarget }))
  })
  for (const { type, requestedTarget } of requests) {
    const another = type === 'resource-create' || /\b(another|second|additional|separate)\b/i.test(goal)
    const selectedExact = requestedTarget && [...active, ...pins].find(w => w.instanceId === requestedTarget && w.widgetType === type)
    const matchingScope = bindingOverride && !selectedExact ? active.filter(w => w.widgetType === type && sameBinding(w.binding, bindingOverride)) : []
    let existing = another ? undefined : matchingScope.length === 1 ? matchingScope[0] : bindingOverride && !selectedExact && active.filter(w => w.widgetType === type).length > 1 && !matchingScope.length ? undefined : resolveTarget({ ...document, active, pins }, selectedExact ? selectedExact.instanceId : type, !!selectedExact)
    const refined = view.continuation?.relationship === 'refinement'
    if (refined && !existing) throw new Error('Choose an existing view before refining it.')
    let bindings = refined && existing ? mergeComponentBindings(instancePlan(existing).bindings, view.continuation!.changes) : view.bindings
    if (view.continuation?.changes.projectId?.operation === 'set') {
      const project = projects.find(p => p.id === bindings.projectId)
      if (!project) throw new Error('This project is no longer available.')
      bindings = { ...bindings, clientId: project.clientId }
    }
    if (view.continuation?.changes.clientId && bindings.projectId && projects.find(p => p.id === bindings.projectId)?.clientId !== bindings.clientId) {
      bindings = { ...bindings, projectId: undefined }
    }
    const explicitScope = !!bindings.projectId || !!bindings.clientId || !!view.continuation?.changes.projectId || !!view.continuation?.changes.clientId || /\b(all projects|all clients|all tasks|workspace tasks)\b/i.test(goal)
    const binding: WidgetBinding = (bindingOverride && supportsBinding(type, bindingOverride.kind) && (bindingOverride.kind !== 'google-calendar' || bindingOverride.mode !== 'browse' || ['calendar', 'meetings', 'availability'].includes(type)) ? bindingOverride : undefined) ?? (explicitScope || !existing ? { kind: 'workspace', projectId: bindings.projectId, clientId: bindings.clientId, draftKey: bindings.draftKey } : existing.binding)
    if (existing && pins.some(p => p.instanceId === existing?.instanceId) && !sameBinding(binding, existing.binding)) {
      // A scope change creates an active view instead of repurposing the original pin.
      existing = active.find(w => w.widgetType === type && sameBinding(w.binding, binding))
    }
    const sameScope = existing && sameBinding(binding, existing.binding)
    const previous = sameScope ? existing!.viewState : undefined
    const { projectId: _project, clientId: _client, draftKey: _draft, category, ...state } = bindings
    const changedFilters = Object.fromEntries(Object.entries(state.taskFilters).filter(([key, value]) => value !== emptyFilters()[key as keyof ReturnType<typeof emptyFilters>]))
    const reset = /\b(all tasks|all statuses|reset filters|clear filters|no filters)\b/i.test(goal)
    const viewState: WidgetViewState = { ...previous, ...Object.fromEntries(Object.entries(state).filter(([, value]) => value !== undefined)), taskFilters: refined ? state.taskFilters : reset ? state.taskFilters : { ...(previous?.taskFilters ?? emptyFilters()), ...changedFilters }, referenceDate: view.referenceDate, timezone: view.timezone, ...(category !== undefined ? { calendarCategory: category } : {}) }
    if (refined) for (const [field, patch] of Object.entries(view.continuation!.changes)) {
      if (patch.operation === 'clear' && !['status', 'priority', 'query', 'sort', 'from', 'to', 'clientId', 'projectId', 'meetingId', 'segment'].includes(field)) {
        Reflect.deleteProperty(viewState, field === 'category' ? 'calendarCategory' : field)
      }
    }
    if (refined && (view.continuation!.changes.from || view.continuation!.changes.to) && !view.continuation!.changes.dateRange) delete viewState.dateRange
    if (refined && view.continuation!.changes.status && !view.continuation!.changes.taskStatuses) delete viewState.taskStatuses
    if (!refined && /upcoming|onward|from now/i.test(goal) && state.taskFilters.from && !state.taskFilters.to) { viewState.taskFilters.to = ''; delete viewState.dateRange }
    if (!refined && reset) { delete viewState.owner; delete viewState.taskStatuses; delete viewState.dateRange }
    if (!refined && (changedFilters.status || /all statuses/i.test(goal)) && !state.taskStatuses) delete viewState.taskStatuses
    if (!refined && /\b(all owners|everyone)\b/i.test(goal)) delete viewState.owner
    if (!refined && /\b(all priorities|any priority)\b/i.test(goal)) viewState.taskFilters.priority = 'all'
    const instance = { ...makeInstance(type, binding, viewState, existing?.instanceId), span: existing?.span ?? 'full', ...(sameScope && existing?.actions ? { actions: existing.actions } : {}), explanation: { type, reason: view.reply, evidence: [] }, label: binding.kind === 'workspace' ? binding.projectId ?? binding.clientId ?? type : existing?.label ?? 'Google Calendar' } satisfies WidgetInstance
    const duplicate = type !== 'resource-create' && !existing && [...active, ...pins].find(w => widgetSelectionKey(w) === widgetSelectionKey(instance))
    if (duplicate && !another) { targets.push(duplicate.instanceId); continue }
    const pin = pins.find(w => w.instanceId === existing?.instanceId)
    if (pin) pins = pins.map(w => w.instanceId === pin.instanceId ? { ...instance, pinId: pin.pinId, createdAt: pin.createdAt } : w)
    else if (existing) active = active.map(w => w.instanceId === existing.instanceId ? instance : w)
    else active.push(instance)
    targets.push(instance.instanceId)
  }
  return commitWorkspace(document, { active, pins, targets })
}
