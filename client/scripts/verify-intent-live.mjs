// Opt-in live evaluation. Load provider credentials with Node's --env-file-if-exists flags.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { componentIntentEndpoint } from '../server/components.ts'
import { makeInstance } from '../src/domain/widgetInstances.ts'
import { instancePlan } from '../src/domain/instanceViews.ts'
import { calendarDate } from '../src/domain/calendar.ts'
import { ADAPTIVE_DEMO } from '../src/data/adaptiveDemo.ts'
const instance = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas', clientId: 'northstar' }, {}, 'atlas-tasks')
const server = createServer((req, res) => { void componentIntentEndpoint(req, res) })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
let failures = 0
try {
  const cases = [
    { goal: 'Only blocked items', field: 'status', value: 'blocked' },
    { goal: 'Just the blocked work', field: 'status', value: 'blocked' },
    { goal: 'High priority too', field: 'priority', value: 'high' },
    { goal: 'Show all statuses again', field: 'status', clear: true },
    { goal: 'Help me get ready for my Northstar call tomorrow', kind: 'meeting_preparation' },
    { goal: 'Investigate Northstar product usage drop', kind: 'usage_investigation' },
  ]
  const selected = process.env.ORLO_LIVE_CASES ? cases.filter(item => process.env.ORLO_LIVE_CASES.split('|').includes(item.goal)) : cases
  for (const item of selected) {
    let diagnostic
    const input = { goal: item.goal, referenceDate: calendarDate(), timezone: 'Asia/Kolkata', previous: instancePlan(instance), instances: [instance], componentPlans: [instancePlan(instance)], workspaceWidgets: ['tasks'], lastTargetIds: [instance.instanceId], catalog: { owners: ['Maya'], projects: ADAPTIVE_DEMO.projects, clients: ADAPTIVE_DEMO.clients, topics: [], draftKeys: [] } }
    try {
      const response = await fetch('http://127.0.0.1:' + server.address().port, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: AbortSignal.timeout(20000) })
      const result = await response.json()
      diagnostic = [result.fallbackReason, result.providerStatus, result.providerCode].filter(Boolean).join(' ')
      assert.equal(response.status, 200)
      assert.equal(result.source, 'ai', result.fallbackReason ?? 'Local fallback')
      if (item.kind) { assert.equal(result.action, 'workflow'); assert.equal(result.kind, item.kind); assert.equal(result.continuation?.relationship, 'new_goal') }
      else {
        assert.equal(result.continuation?.relationship, 'refinement')
        const patch = result.continuation.changes[item.field]
        assert.equal(patch?.operation, item.clear ? 'clear' : 'set')
        if (!item.clear) assert.equal(patch.value, item.value)
      }
      console.log('PASS:', item.goal)
    } catch (error) { failures++; console.log('FAIL:', item.goal, '—', error.message.split('\n')[0], diagnostic ?? '') }
  }
  console.log('Live interpretation evaluation:', selected.length - failures, '/', selected.length, 'passed')
  process.exitCode = failures ? 1 : 0
} finally { await new Promise(resolve => server.close(resolve)) }
