import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { adaptiveEndpoint } from './adaptive.ts'
import { ADAPTIVE_DEMO } from '../src/data/adaptiveDemo.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { createIntentService } from '../src/services/intentService.ts'
import { createHttpClient } from '../src/services/api/httpClient.ts'
import { createMeetingCompositionService } from '../src/services/meetingCompositionService.ts'

const env = { MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' }
function fixtures() {
  const database = createBrowserDatabase(createBrowserStorage(() => { throw new Error('No browser storage in this test') }), { tasks: [], events: [], drafts: {}, dismissed: [], activity: [] }, { ...ADAPTIVE_DEMO, meetings: ADAPTIVE_DEMO.meetings.map(({ eventId: _eventId, ...meeting }) => meeting), resources: [] })
  const service = createAdaptiveDataService(database), catalog = service.loadCandidates(), preparation = service.loadPreparation('northstar-meeting')
  assert.ok(catalog.status === 'found' && preparation.status === 'found')
  return { request: { version: 1 as const, requestId: 'r', goal: 'Prepare tomorrow’s meeting', referenceDate: '2026-10-12', timezone: 'Asia/Kolkata', candidates: catalog.value },
    compose: { version: 1 as const, requestId: 'r', intent: { goalType: 'meeting_preparation' as const, meetingId: 'northstar-meeting', clientId: 'northstar', projectId: 'atlas', dateRange: { from: '2026-10-13', to: '2026-10-13' } }, preparation: preparation.value, agenda: 'Notes' } }
}
async function endpoint(kind: 'intent' | 'compose', body: unknown, config: NodeJS.ProcessEnv = env, options: { raw?: string; method?: string; contentType?: string } = {}) {
  const req = Readable.from([Buffer.from(options.raw ?? JSON.stringify(body))]) as unknown as IncomingMessage
  req.method = options.method ?? 'POST'; req.headers = { 'content-type': options.contentType ?? 'application/json' }
  let status = 0, result = ''
  const res = Object.assign(new EventEmitter(), { headersSent: false, writableEnded: false, writeHead(value: number) { status = value; this.headersSent = true }, end(value: string) { result = value; this.writableEnded = true }, destroy() {} })
  await adaptiveEndpoint(kind, req, res as unknown as ServerResponse, config)
  return { status, body: JSON.parse(result) }
}
async function mockOutput(output: unknown, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    assert.equal(body.store, false); assert.equal(body.text.format.type, 'json_object'); assert.ok(options?.signal)
    return Response.json({ output: [{ content: [{ type: 'output_text', text: typeof output === 'string' ? output : JSON.stringify(output) }] }] })
  }
  try { await run() } finally { globalThis.fetch = original }
}
const composition = { version: 1, requestId: 'r', widgets: ['context', 'outline'].map(type => ({ type, span: 'wide', reason: 'Prepare the selected Northstar meeting.', evidence: [{ kind: 'meeting', id: 'northstar-meeting' }] })) }
test('intent endpoint returns clarification, resolved and unsupported domain responses', async () => {
  const { request, compose } = fixtures()
  const choices = request.candidates.meetings.filter(item => item.date === '2026-10-13').map(({ id, label }) => ({ id, label }))
  for (const output of [
    { version: 1, requestId: 'r', originalGoal: request.goal, status: 'needs_clarification', question: 'Which meeting?', field: 'meetingId', choices, partialIntent: { goalType: 'meeting_preparation', dateRange: compose.intent.dateRange } },
    { version: 1, requestId: 'r', originalGoal: request.goal, status: 'resolved', intent: compose.intent },
    { version: 1, requestId: 'r', originalGoal: request.goal, status: 'unsupported', reason: 'Unsupported goal' },
  ]) await mockOutput(output, async () => { const response = await endpoint('intent', request); assert.equal(response.status, 200); assert.deepEqual(response.body, output) })
})
test('intent endpoint rejects bad requests without calling the provider', async () => {
  const original = globalThis.fetch; let calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('Unexpected network') }
  try {
    for (const body of [null, {}, { ...fixtures().request, version: 2 }]) assert.equal((await endpoint('intent', body)).status, 400)
    assert.equal((await endpoint('intent', {}, env, { raw: '{broken' })).status, 400)
    assert.equal((await endpoint('intent', {}, env, { method: 'GET' })).status, 405)
    assert.equal((await endpoint('intent', {}, env, { contentType: 'text/plain' })).status, 415)
    assert.equal((await endpoint('intent', {}, env, { raw: 'x'.repeat(1_000_001) })).status, 413)
    assert.equal(calls, 0)
  } finally { globalThis.fetch = original }
})
test('invalid model JSON, references and stale identity return 502', async () => {
  const { request, compose } = fixtures()
  for (const value of ['not json', { version: 1, requestId: 'r', originalGoal: request.goal, status: 'resolved', intent: { ...compose.intent, meetingId: 'invented' } }, { version: 1, requestId: 'old', originalGoal: request.goal, status: 'resolved', intent: compose.intent }]) {
    await mockOutput(value, async () => assert.equal((await endpoint('intent', request)).status, 502))
  }
})
test('compose endpoint validates scope and model evidence', async () => {
  const { compose } = fixtures()
  await mockOutput(composition, async () => { assert.equal((await endpoint('compose', compose)).status, 200); assert.equal((await endpoint('compose', { ...compose, intent: { ...compose.intent, meetingId: 'other' } })).status, 400) })
  await mockOutput({ ...composition, widgets: composition.widgets.map(widget => ({ ...widget, evidence: [{ kind: 'issue', id: 'westbridge-assets' }] })) }, async () => assert.equal((await endpoint('compose', compose)).status, 502))
})
test('adaptive endpoint reports missing configuration and provider failures', async () => {
  const { request } = fixtures()
  assert.equal((await endpoint('intent', request, {})).status, 503)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response('', { status: 429 })
    assert.equal((await endpoint('intent', request)).status, 429)
    globalThis.fetch = async () => { throw new TypeError('offline') }
    assert.equal((await endpoint('intent', request)).status, 502)
  } finally { globalThis.fetch = original }
})
test('HTTP service adapters send the same payload and return validated responses', async () => {
  const { request, compose } = fixtures(); const controller = new AbortController()
  const resolved = { version: 1, requestId: 'r', originalGoal: request.goal, status: 'resolved', intent: compose.intent }
  const transport: typeof fetch = async (url, options) => {
    assert.equal(options?.signal, controller.signal)
    assert.equal(options?.method, 'POST')
    assert.deepEqual(JSON.parse(String(options?.body)), String(url) === '/api/intent' ? request : compose)
    return Response.json(String(url) === '/api/intent' ? resolved : composition)
  }
  const http = createHttpClient(transport)
  const intent = createIntentService((payload, options) => http.requestJson('/api/intent', { method: 'POST', body: JSON.stringify(payload), signal: options?.signal }))
  assert.deepEqual(await intent.resolve(request, { signal: controller.signal }), resolved)
  assert.deepEqual(await createMeetingCompositionService(transport).compose(compose, { signal: controller.signal }), composition)
})

test('overdue compose endpoint accepts the alternate contract and rejects cross-project evidence', async () => {
  const { compose } = fixtures()
  const request = { version: 1, kind: 'overdue', requestId: 'r', intent: { goalType: 'overdue_review', projectId: 'atlas', clientId: 'northstar', dateRange: { from: '0001-01-01', to: '2026-10-11' } }, review: { project: compose.preparation.project, client: compose.preparation.client, referenceDate: '2026-10-12', dateRange: { from: '0001-01-01', to: '2026-10-11' }, tasks: [], resources: [], relationships: [], reasons: {} } }
  const plan = { version: 1, requestId: 'r', widgets: ['context', 'tasks'].map(type => ({ type, span: 'full', reason: 'Atlas overdue review has no outstanding tasks.', evidence: [{ kind: 'project', id: 'atlas' }] })) }
  await mockOutput(plan, async () => { assert.equal((await endpoint('compose', request)).status, 200); assert.equal((await endpoint('compose', { ...request, intent: { ...request.intent, projectId: 'launch' } })).status, 400) })
  await mockOutput({ ...plan, widgets: plan.widgets.map(w => ({ ...w, evidence: [{ kind: 'project', id: 'launch' }] })) }, async () => assert.equal((await endpoint('compose', request)).status, 502))
})

test('usage compose endpoint validates scoped measurements and rejects fabricated evidence', async () => {
  const { createUsageWorkspaceService } = await import('../src/services/usageWorkspaceService.ts')
  const { USAGE_DEMO } = await import('../src/data/usageDemo.ts')
  const database = createBrowserDatabase(createBrowserStorage(() => { throw new Error('Memory only') }), { tasks: [], events: [], drafts: {}, dismissed: [], activity: [] }, { ...ADAPTIVE_DEMO, ...USAGE_DEMO, resources: [] })
  const intent = { goalType: 'usage_investigation' as const, clientId: 'northstar', projectId: 'atlas', dateRange: { from: '2026-10-05', to: '2026-10-11' }, constraints: { segment: 'mobile' } }
  const data = createUsageWorkspaceService(database).load(intent)
  assert.ok(data.status === 'found')
  const input = { version: 1, kind: 'usage', requestId: 'usage-api', intent, snapshot: data.value.snapshot, draft: '' }
  const output = { version: 1, requestId: 'usage-api', widgets: ['context', 'usage'].map(type => ({ type, span: 'full', reason: 'Selected measurements for this project.', evidence: [{ kind: 'project', id: 'atlas' }] })) }
  await mockOutput(output, async () => {
    assert.equal((await endpoint('compose', input)).status, 200)
    assert.equal((await endpoint('compose', { ...input, intent: { ...intent, constraints: { segment: 'desktop' } } })).status, 400)
  })
  await mockOutput({ ...output, widgets: output.widgets.map(w => ({ ...w, evidence: [{ kind: 'observation', id: 'invented' }] })) }, async () => assert.equal((await endpoint('compose', input)).status, 502))
})
