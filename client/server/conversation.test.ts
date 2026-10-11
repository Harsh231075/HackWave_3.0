import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyConversation, beginTurn, finishTurn, archiveWorkspace, conversationSchema } from '../src/domain/conversation.ts'

test('the initial state preserves the dashboard until a prompt is submitted', () => {
  assert.deepEqual(emptyConversation(), { active: false, hasWorkspace: false, turns: [] })
})
test('first submission enters conversation without rendering the preloaded dashboard', () => {
  const state = beginTurn(emptyConversation(), 'first', 'Prepare my meeting')
  assert.equal(state.active, true); assert.equal(state.hasWorkspace, false)
  assert.equal(state.turns[0].status, 'pending')
})
test('ready responses enable the active component canvas and retain the user message', () => {
  const ready = finishTurn(beginTurn(emptyConversation(), 'first', 'Add calendar'), 'first', 'ready', 'Calendar ready')
  assert.equal(ready.hasWorkspace, true); assert.equal(ready.turns[0].prompt, 'Add calendar')
  assert.equal(ready.turns[0].reply, 'Calendar ready')
})
test('follow-up loading and failures preserve the existing workspace', () => {
  const ready = finishTurn(beginTurn(emptyConversation(), 'first', 'Add calendar'), 'first', 'ready', 'Ready')
  const following = beginTurn(ready, 'next', 'Add tasks')
  const failed = finishTurn(following, 'next', 'error', 'Try again')
  assert.equal(failed.hasWorkspace, true); assert.equal(failed.turns.length, 2)
  assert.equal(failed.turns[0].status, 'ready')
})
test('clarification and cancellation do not falsely produce a workspace', () => {
  let state = beginTurn(emptyConversation(), 'first', 'Prepare')
  state = finishTurn(state, 'first', 'clarification', 'Which meeting?')
  assert.equal(state.hasWorkspace, false)
  state = finishTurn(state, 'first', 'cancelled', 'Stopped')
  assert.equal(state.active, true); assert.equal(state.hasWorkspace, false)
})
test('stale callbacks cannot restore a canvas after reset', () => {
  const reset = emptyConversation()
  assert.equal(finishTurn(reset, 'old-request', 'ready', 'Late result'), reset)
})
test('history is bounded and persisted state rejects malformed conversations', () => {
  let state = emptyConversation()
  for (let i = 0; i < 65; i++) state = beginTurn(state, String(i), 'A goal')
  assert.equal(state.turns.length, 60); assert.equal(state.turns[0].id, '5')
  assert.equal(conversationSchema.safeParse(state).success, true)
  assert.equal(conversationSchema.safeParse({ active: true, turns: [] }).success, false)
})

test('new responses have their own workspace position below the archived previous response', () => {
  let state = finishTurn(beginTurn(emptyConversation(), 'one', 'Show tasks'), 'one', 'ready', 'Tasks ready')
  const snapshot = { nodes: [{ tag: 'p', attributes: {}, children: ['Original tasks'] }], truncated: false }
  state = archiveWorkspace(state, 'one', snapshot)
  state = finishTurn(beginTurn(state, 'two', 'Add calendar'), 'two', 'ready', 'Calendar ready')
  assert.equal(state.workspaceTurnId, 'two')
  assert.equal(state.turns[0].snapshot?.nodes[0].children[0], 'Original tasks')
  assert.equal(state.turns[1].prompt, 'Add calendar')
  assert.equal(state.turns[1].snapshot, undefined)
  assert.equal(conversationSchema.safeParse(JSON.parse(JSON.stringify(state))).success, true)
})
test('failed follow-ups keep the original response snapshot without marking the new response ready', () => {
  let state = finishTurn(beginTurn(emptyConversation(), 'one', 'Show tasks'), 'one', 'ready', 'Ready')
  state = archiveWorkspace(state, 'one', { nodes: [{ tag: 'div', attributes: {}, children: ['Original view'] }], truncated: false })
  state = finishTurn(beginTurn(state, 'two', 'New request'), 'two', 'error', 'Try again')
  assert.equal(state.turns[0].snapshot?.nodes[0].children[0], 'Original view')
  assert.equal(state.turns[1].status, 'error')
  assert.equal(state.workspaceTurnId, 'two')
})
