import { workspaceSnapshotSchema, type WorkspaceSnapshot } from './workspaceSnapshot.ts'
import { z } from 'zod'
export const conversationSchema = z.object({
  active: z.boolean(), hasWorkspace: z.boolean(), workspaceTurnId: z.string().optional(),
  turns: z.array(z.object({ id: z.string(), prompt: z.string().max(4000), reply: z.string().max(2000), visibleWidgets: z.array(z.string().max(40)).max(20).optional(), snapshot: workspaceSnapshotSchema.optional(), status: z.enum(['pending', 'ready', 'error', 'cancelled', 'clarification']) })).max(60),
})
export type Conversation = z.infer<typeof conversationSchema>
export const emptyConversation = (): Conversation => ({ active: false, hasWorkspace: false, turns: [] })
export function beginTurn(state: Conversation, id: string, prompt: string): Conversation {
  return { ...state, active: true, workspaceTurnId: id, turns: [...state.turns, { id, prompt, reply: 'Preparing your workspace…', status: 'pending' as const }].slice(-60) }
}
export function finishTurn(state: Conversation, id: string, status: Conversation['turns'][number]['status'], reply: string, visibleWidgets?: string[]): Conversation {
  if (!state.turns.some(turn => turn.id === id)) return state
  return { ...state, hasWorkspace: state.hasWorkspace || status === 'ready', turns: state.turns.map(turn => turn.id === id ? { ...turn, status, reply, ...(visibleWidgets ? { visibleWidgets } : {}) } : turn) }
}

export function archiveWorkspace(state: Conversation, id: string, snapshot: WorkspaceSnapshot): Conversation {
  if (!state.turns.some(turn => turn.id === id)) return state
  return { ...state, turns: state.turns.map(turn => turn.id === id ? { ...turn, snapshot } : turn) }
}
