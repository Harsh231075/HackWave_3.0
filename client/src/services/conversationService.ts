import { conversationSchema, emptyConversation, type Conversation } from '../domain/conversation'
export { beginTurn, finishTurn, emptyConversation } from '../domain/conversation'
export type { Conversation } from '../domain/conversation'
const key = 'orlo-workspace-conversation-v1'
export const conversationService = {
  load(): Conversation {
    try { const parsed = conversationSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null')); return parsed.success ? { ...parsed.data, turns: parsed.data.turns.map(turn => turn.status === 'pending' || turn.status === 'clarification' ? { ...turn, status: 'cancelled', reply: 'This request was interrupted. Send your goal again to continue.' } : turn) } : emptyConversation() } catch { return emptyConversation() }
  },
  save(state: Conversation) { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* Live edits remain available if storage is unavailable. */ } },
  clear() { try { localStorage.removeItem(key) } catch { /* Reset is still effective in memory. */ } },
}
