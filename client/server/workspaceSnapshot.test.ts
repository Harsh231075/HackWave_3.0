import { responseWidgetsForPrompt, responseForWidgets } from '../src/domain/workspaceCommands.ts'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { snapshotTagAllowed, safeSnapshotAttribute, snapshotVisibleTo, workspaceSnapshotSchema } from '../src/domain/workspaceSnapshot.ts'
test('historical previews reject executable content and event handlers', () => {
  assert.equal(snapshotTagAllowed('script'), false)
  assert.equal(snapshotTagAllowed('iframe'), false)
  assert.equal(snapshotTagAllowed('foreignObject'), false)
  assert.equal(safeSnapshotAttribute('onclick', 'alert(1)', 'old-'), null)
  assert.equal(safeSnapshotAttribute('href', 'javascript:alert(1)', 'old-'), null)
  assert.equal(safeSnapshotAttribute('src', 'https://remote.example/track', 'old-'), null)
  assert.equal(safeSnapshotAttribute('fill', 'url(https://remote.example/track)', 'old-'), null)
})
test('historical IDs and SVG references cannot collide with the current editable response', () => {
  assert.equal(safeSnapshotAttribute('id', 'chart-clip', 'old-'), 'old-chart-clip')
  assert.equal(safeSnapshotAttribute('clip-path', 'url(#chart-clip)', 'old-'), 'url(#old-chart-clip)')
})
test('saved previews preserve field values, text and presentation without live services', () => {
  const snapshot = { nodes: [{ tag: 'section', attributes: { class: 'rounded-xl' }, children: [{ tag: 'textarea', attributes: { value: 'Keep my original notes' }, children: [] }] }], truncated: false }
  const parsed = workspaceSnapshotSchema.parse(JSON.parse(JSON.stringify(snapshot)))
  assert.equal((parsed.nodes[0].children[0] as { attributes: Record<string, string> }).attributes.value, 'Keep my original notes')
})

test('calendar response history is not displayed under a different connected account', () => {
  const snapshot = { nodes: [], truncated: false, accountId: 'original-account' }
  assert.equal(snapshotVisibleTo(snapshot, 'original-account'), true)
  assert.equal(snapshotVisibleTo(snapshot, 'different-account'), false)
  assert.equal(snapshotVisibleTo(snapshot), false)
  assert.equal(snapshotVisibleTo({ nodes: [], truncated: false }), true)
})

test('existing conversation prompts recover their own component selection without copying the previous layout', () => {
  assert.deepEqual(responseWidgetsForPrompt('add tasks'), ['tasks'])
  assert.deepEqual(responseWidgetsForPrompt('show calendar'), ['calendar'])
  assert.deepEqual(responseWidgetsForPrompt('make calendar full width'), ['calendar'])
  assert.deepEqual(responseWidgetsForPrompt('remove chart'), [])
  assert.equal(responseWidgetsForPrompt('Prepare for tomorrow’s meeting'), undefined)
})

test('the rendered task reply excludes old calendar widgets and explanatory content while retaining task span', () => {
  const working = 'root = Card([TextContent("Old calendar explanation"), Workspace([WorkspaceWidget("calendar", "wide"), WorkspaceWidget("tasks", "full")])])'
  const reply = responseForWidgets(working, ['tasks'])
  assert.equal(reply, 'root = Card([Workspace([WorkspaceWidget("tasks", "full")])])')
  assert.ok(!reply.includes('calendar')); assert.ok(!reply.includes('Old calendar explanation'))
  assert.match(responseForWidgets(working, ['calendar']), /"calendar", "wide"/)
})
