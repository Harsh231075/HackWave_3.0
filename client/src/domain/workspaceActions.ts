import { z } from 'zod'
import { intentDateSchema } from './intent.ts'
import type { WidgetBinding } from './widgetInstances.ts'
import type { Task } from './types.ts'
export const workspaceActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('task.edit'), taskId: z.string().min(1).max(200) }),
  z.strictObject({ type: z.literal('draft.edit') }),
  z.strictObject({ type: z.literal('focus.schedule'), taskId: z.string().min(1).max(200), date: intentDateSchema.optional() }),
  z.strictObject({ type: z.literal('goal.change'), goal: z.string().trim().min(1).max(4000) }),
])
export const workspaceActionButtonSchema = z.strictObject({ label: z.string().trim().min(1).max(80), action: workspaceActionSchema })
export const compositionActionsSchema = workspaceActionButtonSchema.array().max(4).optional()
export type WorkspaceAction = z.infer<typeof workspaceActionSchema>
export type ActionOrigin = { binding: WidgetBinding; referenceDate: string; revision: number; pinId?: string; instanceId?: string }
export function actionReferencesValid(actions: z.infer<typeof compositionActionsSchema>, tasks: Task[], allowDraft: boolean) {
  return (actions ?? []).every(({ action }) => action.type === 'draft.edit' ? allowDraft : action.type === 'goal.change' || tasks.some(t => t.id === action.taskId && (action.type !== 'focus.schedule' || (t.status === 'pending' && Number.isInteger(t.duration) && t.duration >= 5 && t.duration <= 480))))
}
export function serializeActionButtons(actions: z.infer<typeof compositionActionsSchema>) {
  return (actions ?? []).map(button => ', WorkspaceAction(' + JSON.stringify(button.label) + ', ' + JSON.stringify(button.action) + ')').join('')
}
