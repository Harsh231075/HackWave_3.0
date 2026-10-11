import { createParser } from '@openuidev/lang-core'
import { workspaceActionButtonSchema, actionReferencesValid, type WorkspaceAction } from '../../domain/workspaceActions.ts'
import type { Task } from '../../domain/types.ts'
export function generatedActionsValid(response: string, library: Parameters<typeof createParser>[0], root: Parameters<typeof createParser>[1], tasks: Task[], allowDraft = true): boolean {
  try {
    const parsed = createParser(library, root).parse(response)
    if (!parsed.root || parsed.meta.errors.length || parsed.meta.incomplete || parsed.meta.unresolved.length || parsed.queryStatements.length || parsed.mutationStatements.length) return false
    let valid = true, count = 0
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return }
      if (!value || typeof value !== 'object') return
      const node = value as Record<string, unknown>
      if (node.typeName === 'WorkspaceAction') {
        count++
        const button = workspaceActionButtonSchema.safeParse(node.props)
        if (!button.success || !actionReferencesValid(button.success ? [button.data] : [], tasks, allowDraft)) valid = false
      }
      if (node.k === 'Comp' && ['OpenUrl', 'Run', 'ToAssistant'].includes(String(node.name))) valid = false
      if (Array.isArray(node.steps) && node.steps.some(step => !step || typeof step !== 'object' || !['set', 'reset'].includes((step as { type: string }).type))) valid = false
      // Legacy object-style action props can bypass ActionPlan; permit no external handler.
      if (node.typeName && node.props && typeof node.props === 'object') {
        for (const name of ['action', 'onSubmit']) {
          const action = (node.props as Record<string, unknown>)[name]
          if (action && typeof action === 'object' && !('steps' in action) && node.typeName !== 'WorkspaceAction' && !('k' in action && action.k === 'Comp' && 'name' in action && action.name === 'Action')) valid = false
        }
      }
      Object.values(node).forEach(visit)
    }
    visit(parsed.root)
    return valid && count <= 4
  } catch { return false }
}
export function applicationActionEvent(event: unknown): WorkspaceAction | null {
  if (!event || typeof event !== 'object') return null
  const item = event as { type?: string; params?: unknown }
  if (item.type !== 'workspace_action' || !item.params || typeof item.params !== 'object' || Object.keys(item.params).length !== 1 || !('action' in item.params)) return null
  const parsed = workspaceActionButtonSchema.shape.action.safeParse((item.params as { action: unknown }).action)
  return parsed.success ? parsed.data : null
}
