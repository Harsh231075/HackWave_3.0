import { z } from 'zod'
export const conversationSchema = z.object({
  active: z.boolean(), hasWorkspace: z.boolean(),
  turns: z.array(z.object({ id: z.string(), prompt: z.string().max(4000), reply: z.string().max(2000), status: z.enum(['pending', 'ready', 'error', 'cancelled', 'clarification']) })).max(60),
})
export type Conversation = z.infer<typeof conversationSchema>
export const emptyConversation = (): Conversation => ({ active: false, hasWorkspace: false, turns: [] })
export function beginTurn(state: Conversation, id: string, prompt: string): Conversation {
  return { ...state, active: true, turns: [...state.turns, { id, prompt, reply: 'Preparing your workspace…', status: 'pending' as const }].slice(-60) }
}
export function finishTurn(state: Conversation, id: string, status: Conversation['turns'][number]['status'], reply: string): Conversation {
  if (!state.turns.some(turn => turn.id === id)) return state
  return { ...state, hasWorkspace: state.hasWorkspace || status === 'ready', turns: state.turns.map(turn => turn.id === id ? { ...turn, status, reply } : turn) }
}
