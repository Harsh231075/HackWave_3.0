import { z } from 'zod'

const change = <T extends z.ZodType>(value: T) => z.union([
  z.strictObject({ operation: z.literal('set'), value }),
  z.strictObject({ operation: z.literal('clear') }),
])
const id = z.string().trim().min(1).max(200)
const date = z.iso.date()
const range = z.strictObject({ from: date, to: date }).refine(value => value.from <= value.to, 'Dates must be ordered.')
export const intentChangesSchema = z.strictObject({
  clientId: change(id).optional(), projectId: change(id).optional(), meetingId: change(id).optional(),
  dateRange: change(range).optional(), selectedDate: change(date).optional(),
  status: change(z.enum(['all', 'pending', 'blocked', 'completed', 'overdue'])).optional(),
  priority: change(z.enum(['all', 'urgent', 'high', 'medium', 'low'])).optional(),
  owner: change(z.string().trim().min(1).max(160)).optional(), segment: change(id).optional(),
  query: change(z.string().max(160)).optional(), sort: change(z.enum(['due', 'priority'])).optional(),
  from: change(date).optional(), to: change(date).optional(),
  taskStatuses: change(z.array(z.enum(['pending', 'blocked', 'completed'])).min(1).max(3)).optional(),
  taskView: change(z.enum(['list', 'kanban'])).optional(),
  calendarView: change(z.enum(['month', 'week', 'day', 'agenda'])).optional(),
  category: change(z.enum(['all', 'meeting', 'focus', 'class', 'break'])).optional(),
  chartType: change(z.enum(['trend', 'comparison', 'allocation'])).optional(),
  resourceQuery: change(z.string().max(160)).optional(), recordQuery: change(z.string().max(160)).optional(),
  issueStatus: change(z.enum(['open', 'closed'])).optional(),
})
export const continuationChangeSchema = z.strictObject({
  relationship: z.enum(['new_goal', 'refinement']),
  targetInstanceIds: id.array().max(14).default([]),
  changes: intentChangesSchema.default({}),
}).refine(value => new Set(value.targetInstanceIds).size === value.targetInstanceIds.length, 'Targets must be unique.')
export type IntentChanges = z.infer<typeof intentChangesSchema>
export type ContinuationChange = z.infer<typeof continuationChangeSchema>
export const continuationInstructions = `
Every view or workflow response includes continuation: {relationship:"new_goal"|"refinement",targetInstanceIds:[],changes:{}}.
A refinement changes an existing goal/view; "only blocked items", "just blocked work", "high priority too", "tomorrow instead", "same review" are refinements. Different complete tasks are new_goal.
Use only supplied instance IDs. If multiple compatible views exist and no prior target or wording distinguishes them, leave targets empty so the application can ask.
Changes use {operation:"set",value:...} or {operation:"clear"}. Omitted fields retain the baseline. Declare only what the user asks to change; never restate retained defaults.
Example "Only blocked items": changes: {"status":{"operation":"set","value":"blocked"}}. Changes are flat; taskFilters is not a change field. Clearing taskStatuses also clears the status refinement.
Fields: clientId,projectId,meetingId,dateRange,selectedDate,status,priority,owner,segment,query,sort,from,to,taskStatuses,taskView,calendarView,category,chartType,resourceQuery,recordQuery,issueStatus.
"All priorities" clears priority, "all owners" clears owner, "all segments" clears segment, "all statuses" clears status and taskStatuses. Clear presentation refinements, never required ownership.
A project switch sets projectId; application derives its client. A meeting switch sets meetingId; application derives its project/client/date. Never edit a pin's ownership. Pinned saved views are excluded from implicit targeting; only target them when the user explicitly names a pin. Adaptive workflows refine one validated scope at a time; ask which scope when requested targets have different bindings.
`
