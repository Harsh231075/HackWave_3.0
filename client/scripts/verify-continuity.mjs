// Optional browser evaluation. Supply Playwright/browser paths through the same env vars as verify-actions.
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const { chromium } = await import(process.env.ORLO_PLAYWRIGHT_MODULE || 'playwright')
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } })
await server.listen()
const browser = await chromium.launch({ headless: true, ...(process.env.ORLO_CHROME_PATH ? { executablePath: process.env.ORLO_CHROME_PATH } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(15000)
  const base = 'http://127.0.0.1:' + server.httpServer.address().port
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error' && msg.text().includes('Cannot update a component')) errors.push(msg.text()) })
  const { makeInstance } = await server.ssrLoadModule('/src/domain/widgetInstances.ts')
  const { emptyWorkspace } = await server.ssrLoadModule('/src/domain/workspaceDocument.ts')
  let resolverCalls = 0, intentCalls = 0, fail = false, invalidComposition = false, holdComposition = false, releaseComposition, compositionHeld
  let signalHeld
  compositionHeld = new Promise(resolve => { signalHeld = resolve })
  const last = () => page.evaluate(() => JSON.parse(localStorage.getItem('orlo-browser-db-v1')).collections.workspaceDocument)
  const intent = { goalType: 'overdue_review', clientId: 'northstar', projectId: 'atlas', dateRange: { from: '0001-01-01', to: '2026-10-11' } }
  await page.route('**/api/workspace/resolve', async route => {
    resolverCalls++
    const input = route.request().postDataJSON()
    if (fail) { await route.fulfill({ json: { action: 'clarify', question: 'Provider unavailable. Try again.', choices: [] } }); return }
    const lower = input.goal.toLowerCase()
    if (lower.includes('prepare')) {
      await route.fulfill({ json: { action: 'workflow', kind: 'meeting_preparation', continuation: { relationship: 'new_goal', targetInstanceIds: [], changes: {} } } }); return
    }
    if (lower.includes('investigate')) {
      await route.fulfill({ json: { action: 'workflow', kind: 'usage_investigation', continuation: { relationship: 'new_goal', targetInstanceIds: [], changes: {} } } }); return
    }
    if (lower.includes('mobile') || lower.includes('2026-10-05')) {
      const changes = lower.includes('mobile') ? { segment: { operation: 'set', value: 'mobile' } } : { dateRange: { operation: 'set', value: { from: '2026-10-05', to: '2026-10-10' } } }
      await route.fulfill({ json: { action: 'view', widgets: ['usage'], bindings: {}, referenceDate: input.referenceDate, timezone: input.timezone, reply: 'Updated usage.', continuation: { relationship: 'refinement', targetInstanceIds: [], changes } } }); return
    }
    if (lower.includes('review')) {
      await route.fulfill({ json: { action: 'workflow', kind: 'overdue_review', continuation: { relationship: 'new_goal', targetInstanceIds: [], changes: {} } } }); return
    }
    const changes = lower.includes('priority') ? { priority: { operation: 'set', value: 'high' } } : { status: { operation: 'set', value: 'blocked' } }
    await route.fulfill({ json: { action: 'view', widgets: ['tasks'], bindings: {}, referenceDate: input.referenceDate, timezone: input.timezone, reply: 'Selection updated.', continuation: { relationship: 'refinement', targetInstanceIds: [], changes } } })
  })
  await page.route('**/api/intent', async route => {
    intentCalls++
    const input = route.request().postDataJSON()
    if (input.goal.toLowerCase().includes('prepare')) {
      const candidates = input.candidates.meetings.filter(m => ['northstar-meeting', 'westbridge-meeting'].includes(m.id))
      if (!input.clarificationAnswer) {
        await route.fulfill({ json: { version: 1, requestId: input.requestId, originalGoal: input.goal, status: 'needs_clarification', field: 'meetingId', question: 'Which meeting?', choices: candidates.map(m => ({ id: m.id, label: m.label })), partialIntent: { goalType: 'meeting_preparation', dateRange: { from: candidates[0].date, to: candidates[0].date } } } }); return
      }
      const meeting = candidates.find(m => m.id === input.clarificationAnswer.selectedId)
      await route.fulfill({ json: { version: 1, requestId: input.requestId, originalGoal: input.goal, status: 'resolved', intent: { goalType: 'meeting_preparation', meetingId: meeting.id, clientId: meeting.clientId, projectId: meeting.projectId, dateRange: { from: meeting.date, to: meeting.date } } } }); return
    }
    if (input.goal.toLowerCase().includes('investigate') || input.previousIntent?.goalType === 'usage_investigation') {
      const scope = input.candidates.usageScopes.find(s => s.projectId === 'atlas')
      await route.fulfill({ json: { version: 1, requestId: input.requestId, originalGoal: input.goal, status: 'resolved', intent: { goalType: 'usage_investigation', clientId: 'northstar', projectId: 'atlas', dateRange: scope.dateRange } } }); return
    }
    // Intentionally wrong replacement scope: explicit patches must override it for refinements.
    await route.fulfill({ json: { version: 1, requestId: input.requestId, originalGoal: input.goal, status: 'resolved', intent: input.continuation?.relationship === 'refinement' ? { ...intent, projectId: 'launch', clientId: 'westbridge' } : intent } })
  })
  await page.route('**/api/workspace/compose', async route => {
    const input = route.request().postDataJSON()
    if (holdComposition) { signalHeld(); await new Promise(resolve => { releaseComposition = resolve }) }
    const meeting = !!input.preparation
    await route.fulfill({ json: { version: 1, requestId: input.requestId, widgets: (meeting ? ['context', 'outline', 'tasks'] : input.kind === 'usage' ? ['context', 'usage', 'metrics'] : ['context', 'tasks', 'metrics']).map(type => ({ type, span: 'full', reason: 'Selected scoped records.', evidence: [{ kind: meeting ? 'meeting' : 'project', id: invalidComposition ? 'missing-evidence' : meeting ? input.intent.meetingId : input.intent.projectId }] })) } })
  })
  await page.goto(base)
  await page.waitForSelector('[data-instance-id]')
  async function submit(goal) {
    await page.keyboard.press('Control+k')
    await page.getByRole('textbox', { name: 'Describe the workspace you need' }).fill(goal)
    await page.getByRole('button', { name: 'Build workspace' }).click()
  }
  async function completed() {
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('orlo-browser-db-v1') ?? '{}').collections?.workspaceDocument?.turns?.at(-1)?.status === 'ready').catch(async error => { console.error(JSON.stringify((await last()).turns.at(-1)), await page.locator('body').innerText()); throw error })
  }
  await submit('Review overdue Atlas work'); await completed()
  await submit('Only blocked items'); await completed()
  let doc = await last()
  assert.equal(doc.continuation.lastSuccess.intent.projectId, 'atlas')
  assert.equal(doc.continuation.lastSuccess.intent.constraints.status, 'blocked')
  await page.getByRole('navigation', { name: 'Workspace pages' }).getByRole('link', { name: 'Tasks', exact: true }).click()
  await page.getByRole('navigation', { name: 'Workspace pages' }).getByRole('link', { name: 'Workspace', exact: true }).click()
  const count = resolverCalls + intentCalls
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  assert.equal(resolverCalls + intentCalls, count)
  await submit('High priority too'); await completed()
  doc = await last()
  assert.deepEqual(doc.continuation.lastSuccess.intent.constraints, { status: 'blocked', priority: 'high' })
  assert.equal(doc.continuation.lastSuccess.intent.projectId, 'atlas')
  console.log('PASS: inherited overdue scope, navigation/reload, accumulated constraints, no navigation generation')

  await submit('Investigate Northstar product usage drop'); await completed()
  const usageRange = (await last()).continuation.lastSuccess.intent.dateRange
  await submit('Only mobile usage'); await completed()
  assert.equal((await last()).continuation.lastSuccess.intent.constraints.segment, 'mobile')
  assert.deepEqual((await last()).continuation.lastSuccess.intent.dateRange, usageRange)
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await submit('Use dates 2026-10-05 through 2026-10-10 instead'); await completed()
  const usageIntent = (await last()).continuation.lastSuccess.intent
  assert.equal(usageIntent.clientId, 'northstar')
  assert.equal(usageIntent.projectId, 'atlas')
  assert.equal(usageIntent.constraints.segment, 'mobile')
  assert.deepEqual(usageIntent.dateRange, { from: '2026-10-05', to: '2026-10-10' })
  console.log('PASS: usage segment/date inheritance and restored composition continuity')

  // Create two independent active task views; an unanswered target question must survive reload.
  const first = makeInstance('tasks', { kind: 'workspace', projectId: 'atlas', clientId: 'northstar' }, {}, 'atlas-target')
  const second = makeInstance('tasks', { kind: 'workspace', projectId: 'launch', clientId: 'westbridge' }, {}, 'launch-target')
  const seed = { ...emptyWorkspace(), active: [first, second] }
  await page.evaluate(document => { const db = JSON.parse(localStorage.getItem('orlo-browser-db-v1')); db.collections.workspaceDocument = document; localStorage.setItem('orlo-browser-db-v1', JSON.stringify(db)) }, seed)
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await submit('Only blocked work')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('orlo-browser-db-v1')).collections.workspaceDocument.continuation?.pending?.kind === 'component')
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await page.keyboard.press('Control+k')
  assert.match(await page.getByRole('dialog').innerText(), /Choose which/)
  const beforeAnswer = resolverCalls
  await page.getByRole('button', { name: 'atlas', exact: true }).click(); await completed()
  doc = await last()
  assert.equal(resolverCalls, beforeAnswer)
  assert.equal(doc.active.find(w => w.instanceId === first.instanceId).viewState.taskFilters.status, 'blocked')
  assert.equal(doc.active.find(w => w.instanceId === second.instanceId).viewState.taskFilters.status, 'all')
  console.log('PASS: target clarification restored, exact saved patch applied without reinterpretation')

  await page.evaluate(document => { const db = JSON.parse(localStorage.getItem('orlo-browser-db-v1')); db.collections.workspaceDocument = document; localStorage.setItem('orlo-browser-db-v1', JSON.stringify(db)) }, seed)
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await submit('Only blocked work')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('orlo-browser-db-v1')).collections.workspaceDocument.continuation?.pending)
  await page.evaluate(() => { const db = JSON.parse(localStorage.getItem('orlo-browser-db-v1')); db.collections.workspaceDocument.active = db.collections.workspaceDocument.active.filter(w => w.instanceId !== 'launch-target'); localStorage.setItem('orlo-browser-db-v1', JSON.stringify(db)) })
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await page.keyboard.press('Control+k')
  await page.getByRole('button', { name: 'Refresh question', exact: true }).click()
  await completed()
  assert.equal((await last()).active[0].viewState.taskFilters.status, 'blocked')
  console.log('PASS: stale target question rejected and refreshed against current records')

  await submit('Prepare tomorrow meeting')
  await page.getByRole('button', { name: 'Use demo records', exact: true }).click()
  await page.getByRole('combobox', { name: 'Clarification choice' }).waitFor()
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Clarification choice' }).click()
  await page.getByRole('option').filter({ hasText: 'Northstar' }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click(); await completed()
  doc = await last()
  assert.equal(doc.continuation.lastSuccess.intent.meetingId, 'northstar-meeting')
  console.log('PASS: entity clarification restored and original goal continued')

  // Retain an original meeting pin while switching to overdue work.
  const meetingTasks = doc.active.find(w => w.widgetType === 'tasks' && w.binding.kind === 'meeting')
  assert.ok(meetingTasks)
  const originalPin = { ...meetingTasks, pinId: 'retained-pin', createdAt: new Date().toISOString() }
  await page.evaluate(pin => { const db = JSON.parse(localStorage.getItem('orlo-browser-db-v1')); const d = db.collections.workspaceDocument; d.active = d.active.filter(w => w.instanceId !== pin.instanceId); d.pins = [pin]; localStorage.setItem('orlo-browser-db-v1', JSON.stringify(db)) }, originalPin)
  await page.reload(); await page.waitForSelector('[data-instance-id]')
  await submit('Review overdue Atlas work'); await completed()
  assert.deepEqual((await last()).pins[0], originalPin)
  const stable = (await last()).active
  invalidComposition = true
  await submit('Review overdue Atlas work')
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('orlo-browser-db-v1')).collections.workspaceDocument.turns.at(-1).status === 'error')
  assert.deepEqual((await last()).active, stable)
  invalidComposition = false
  await page.keyboard.press('Control+k')
  holdComposition = true
  await submit('Review overdue Atlas work')
  await compositionHeld
  await page.getByRole('button', { name: 'Workspace options', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Reset layout', exact: true }).click()
  const reset = (await last()).active
  releaseComposition(); holdComposition = false
  await page.waitForTimeout(300)
  assert.deepEqual((await last()).active, reset)
  assert.deepEqual((await last()).pins[0], originalPin)
  assert.equal((await last()).continuation, undefined)
  assert.equal((await last()).turns.at(-1).status, 'cancelled')
  console.log('PASS: invalid evidence and late composition after reset preserve the valid canvas')
  const afterReset = (await last()).active
  fail = true
  await submit('Only blocked items')
  await page.getByText('Provider unavailable. Try again.', { exact: true }).first().waitFor()
  assert.deepEqual((await last()).active, afterReset)
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(250)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await page.keyboard.press('Control+k')
  await page.getByRole('dialog').waitFor()
  await page.waitForTimeout(250)
  const bounds = await page.getByRole('dialog').boundingBox()
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, JSON.stringify(bounds))
  assert.deepEqual(errors, [])
  console.log('PASS: pin continuity, failure preservation, keyboard/mobile dialogs; no page errors')
} finally { await browser.close(); await server.close() }
