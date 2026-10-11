import { isMailWidget, mailFolders, mailWidgetIds } from './mail.ts'
import { compositionActionsSchema } from './workspaceActions.ts'
import { meetingWidgetTypes } from './adaptiveData.ts'
import { usageWidgetTypes } from './usageComposition.ts'
import { overdueWidgetTypes } from './overdueReview.ts'
import { z } from 'zod'
import type { Filters } from './types.ts'
import { widgetTypes, type WidgetType } from '../lib/workspace/config.ts'
import { resolvedIntentSchema } from './intent.ts'
import { usageQuerySchema } from './usage.ts'
import { emptyFilters } from './workspace.ts'

export const widgetBindingKinds = ['workspace', 'meeting', 'usage', 'usage-query', 'overdue', 'google-calendar', 'gmail'] as const
export const MAX_PINS = 6
export const MAX_CANVAS_WIDGETS = 14
export const taskFiltersSchema: z.ZodType<Filters, Filters> = z.strictObject({
  query: z.string(), status: z.enum(['all', 'pending', 'blocked', 'completed', 'overdue']),
  priority: z.enum(['all', 'urgent', 'high', 'medium', 'low']), sort: z.enum(['due', 'priority']),
  from: z.union([z.literal(''), z.iso.date()]), to: z.union([z.literal(''), z.iso.date()]),
}).refine(f => !f.from || !f.to || f.from <= f.to, 'Task filter dates must be ordered.')
export const timezoneSchema = z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false } }, 'Choose a valid timezone.')
export const widgetBindingSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('gmail'), accountId: z.string().min(1).optional(), messageId: z.string().min(1).optional(), draftId: z.string().min(1).optional() }),
  z.strictObject({ kind: z.literal('workspace'), clientId: z.string().min(1).optional(), projectId: z.string().min(1).optional(), draftKey: z.string().min(1).optional() }),
  z.strictObject({ kind: z.literal('google-calendar'), accountId: z.string().min(1), calendarId: z.literal('primary'), eventId: z.string().min(1).optional(), mode: z.enum(['browse', 'prepare', 'schedule']).default('browse') }),
  z.strictObject({ kind: z.literal('meeting'), meetingId: z.string().min(1), clientId: z.string().min(1).optional(), projectId: z.string().min(1) }),
  z.strictObject({ kind: z.literal('usage'), intent: resolvedIntentSchema.refine(i => i.goalType === 'usage_investigation') }),
  z.strictObject({ kind: z.literal('usage-query'), query: usageQuerySchema }),
  z.strictObject({ kind: z.literal('overdue'), intent: resolvedIntentSchema.refine(i => i.goalType === 'overdue_review'), referenceDate: z.iso.date() }),
])
export const widgetViewStateSchema = z.strictObject({
  mailFolder: z.enum(mailFolders).optional(),
  taskFilters: taskFiltersSchema.default(emptyFilters), selectedDate: z.iso.date().optional(),
  calendarView: z.enum(['month', 'week', 'day', 'agenda']).optional(),
  calendarCategory: z.enum(['all', 'meeting', 'class', 'focus', 'break']).optional(),
  referenceDate: z.iso.date().optional(), timezone: timezoneSchema.optional(),
  owner: z.string().max(160).optional(), taskStatuses: z.array(z.enum(['pending', 'blocked', 'completed'])).min(1).max(3).optional(),
  dateRange: z.object({ from: z.iso.date(), to: z.iso.date() }).refine(r => r.from <= r.to).optional(),
  taskView: z.enum(['list', 'kanban']).optional(), chartType: z.enum(['trend', 'comparison', 'allocation']).optional(),
  resourceQuery: z.string().max(160).optional(), recordQuery: z.string().max(160).optional(), issueStatus: z.enum(['open', 'closed']).optional(),
  goal: z.string().max(4000).optional(), externalPluginId: z.string().optional(), timerDurationMinutes: z.number().int().min(1).max(180).optional(), selectedTaskId: z.string().min(1).optional(),
})
export const widgetExplanationSchema = z.strictObject({ type: z.enum(widgetTypes), reason: z.string().max(5000), evidence: z.array(z.strictObject({ kind: z.string().min(1), id: z.string().min(1) })).max(20) })
export type WidgetExplanation = z.infer<typeof widgetExplanationSchema>
const instanceShape = {
  actions: compositionActionsSchema,
  instanceId: z.string().min(1), widgetType: z.enum(widgetTypes), span: z.enum(['full', 'wide', 'narrow']),
  binding: widgetBindingSchema, viewState: widgetViewStateSchema,
  explanation: widgetExplanationSchema, fingerprint: z.string(), label: z.string().min(1),
}
const validInstance = (i: { explanation: WidgetExplanation; widgetType: WidgetType; binding: WidgetBinding }) => i.explanation.type === i.widgetType && supportsBinding(i.widgetType, i.binding.kind)
export const widgetInstanceSchema = z.strictObject(instanceShape).refine(validInstance, 'Widget does not support this binding.')
export const pinnedWidgetSchema = z.strictObject({ ...instanceShape, pinId: z.string().min(1), createdAt: z.iso.datetime() }).refine(validInstance, 'Widget does not support this binding.')
export type WidgetBinding = z.infer<typeof widgetBindingSchema>
export type WidgetViewState = z.infer<typeof widgetViewStateSchema>
export type WidgetInstance = z.infer<typeof widgetInstanceSchema>
export type PinnedWidget = WidgetInstance & { pinId: string; createdAt: string }
const bindings: Record<WidgetBinding['kind'], readonly WidgetType[]> = {
  workspace: widgetTypes.filter(type => !isMailWidget(type)),
  gmail: mailWidgetIds,
  'google-calendar': ['calendar', 'meetings', 'availability', 'context', 'outline'],
  meeting: meetingWidgetTypes,
  usage: usageWidgetTypes,
  'usage-query': ['usage'], overdue: overdueWidgetTypes,
}
export function supportsBinding(type: WidgetType, kind: WidgetBinding['kind']) { return bindings[kind].includes(type) }
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)]))
  return value
}
export function sameBinding(left: WidgetBinding, right: WidgetBinding) { return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right)) }
export function fingerprint(value: unknown) {
  let hash = 2166136261
  for (const c of JSON.stringify(canonical(value))) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16)
}
export function widgetSelectionKey(instance: Pick<WidgetInstance, 'widgetType' | 'binding' | 'viewState'> & {instanceId?:string}) {
  const { widgetType: type, binding, viewState } = instance
  const filtersMatter = type === 'tasks' || (binding.kind === 'overdue' && ['context', 'metrics', 'recommendation'].includes(type))
  const calendar = ['calendar', 'timeline', 'availability', 'meetings'].includes(type) && (binding.kind === 'workspace' || binding.kind === 'google-calendar')
  const effectiveBinding = type === 'usage' && binding.kind === 'usage' ? { kind: 'usage-query', query: { clientId: binding.intent.clientId, projectId: binding.intent.projectId, dateRange: binding.intent.dateRange, segment: binding.intent.constraints?.segment } } : binding
  return JSON.stringify(canonical({ type, binding: effectiveBinding, ...(isMailWidget(type) ? {mailFolder:viewState.mailFolder} : {}), ...(type==='external-plugin'?{externalPluginId:viewState.externalPluginId}:{}), ...(type === 'resource-create' ? {formId:instance.instanceId} : {}), ...(filtersMatter ? { filters: viewState.taskFilters, owner: viewState.owner, statuses: viewState.taskStatuses } : {}), ...(calendar ? { date: viewState.selectedDate, range: viewState.dateRange, timezone: viewState.timezone, ...(type === 'calendar' ? { view: viewState.calendarView, category: viewState.calendarCategory } : {}) } : {}) }))
}
export function activeInstanceId(type: WidgetType, binding: WidgetBinding) { return `active:${type}:${fingerprint(binding)}` }
export function planWidgetCanvas(active: WidgetInstance[], pins: PinnedWidget[], kind: WidgetBinding['kind'] = 'workspace') {
  const saved = new Set(pins.map(widgetSelectionKey))
  const seen = new Set<string>()
  const distinct = active.filter(w => { if (seen.has(w.instanceId)) return false; seen.add(w.instanceId); return !saved.has(widgetSelectionKey(w)) })
  const required = kind === 'meeting' ? ['context', 'outline'] : kind === 'usage' ? ['context', 'usage'] : kind === 'overdue' ? ['context', 'tasks'] : [distinct[0]?.widgetType, 'tasks', 'context', 'usage', 'outline']
  const mandatory = distinct.filter(w => required.includes(w.widgetType))
  const optional = distinct.filter(w => !required.includes(w.widgetType))
  const chosen = new Set([...mandatory, ...optional.slice(0, Math.max(0, MAX_CANVAS_WIDGETS - pins.length - mandatory.length))].map(w => w.instanceId))
  return { active: distinct.filter(w => chosen.has(w.instanceId)), pins, omitted: distinct.length - chosen.size }
}

export function makeInstance(widgetType: WidgetType, binding: WidgetBinding = { kind: 'workspace' }, viewState: Partial<WidgetViewState> = {}, id: string = crypto.randomUUID()): WidgetInstance {
  if (isMailWidget(widgetType) && binding.kind === 'workspace') binding = { kind: 'gmail' }
  return widgetInstanceSchema.parse(JSON.parse(JSON.stringify({ instanceId: id, widgetType, span: 'full', binding, viewState: { taskFilters: emptyFilters(), ...viewState }, explanation: { type: widgetType, reason: 'Selected for your workspace.', evidence: [] }, fingerprint: '', label: binding.kind === 'workspace' ? binding.projectId ?? binding.clientId ?? widgetType : binding.kind === 'google-calendar' ? 'Google Calendar' : binding.kind === 'meeting' ? binding.meetingId : binding.kind })))
}
