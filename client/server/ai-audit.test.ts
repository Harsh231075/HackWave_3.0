import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { chat } from './chat.ts'

const ui = 'root = Card([Workspace([WorkspaceWidget("tasks", "full")])])'
const groq = { MODEL_PROVIDER: 'groq', GROQ_API_KEY: 'test-only', GROQ_MODEL: 'test-model' }
async function request(body: unknown, env: NodeJS.ProcessEnv = {}, options: { method?: string; contentType?: string; raw?: string } = {}) {
  const req = Readable.from([Buffer.from(options.raw ?? JSON.stringify(body))]) as unknown as IncomingMessage
  req.method = options.method ?? 'POST'
  req.headers = { 'content-type': options.contentType ?? 'application/json' }
  let status = 0, response = ''
  const res = Object.assign(new EventEmitter(), {
    headersSent: false, writableEnded: false,
    writeHead(code: number) { status = code; this.headersSent = true },
    end(value = '') { response = value; this.writableEnded = true }, destroy() {},
  })
  await chat(req, res as unknown as ServerResponse, env)
  return { status, body: response ? JSON.parse(response) : undefined }
}
async function withFetch(mock: typeof fetch, run: () => Promise<void>) {
  const original = globalThis.fetch
  globalThis.fetch = mock
  try { await run() } finally { globalThis.fetch = original }
}
for (const [name, body, options, expected] of [
  ['GET rejected', {}, { method: 'GET' }, 405],
  ['wrong content type rejected', {}, { contentType: 'text/plain' }, 415],
  ['invalid JSON rejected', {}, { raw: '{broken' }, 400],
  ['missing goal rejected', {}, {}, 400],
  ['blank goal rejected', { goal: '   ' }, {}, 400],
  ['non-string goal rejected', { goal: 123 }, {}, 400],
  ['overlong goal rejected', { goal: 'x'.repeat(4001) }, {}, 400],
  ['oversized request rejected', {}, { raw: 'x'.repeat(1_000_001) }, 413],
] as const) test(name, async () => assert.equal((await request(body, {}, options)).status, expected))

test('missing Groq key returns 503 without local fallback', async () => {
  assert.equal((await request({ goal: 'Plan my day' })).status, 503)
})
test('missing OpenAI model returns 503', async () => {
  assert.equal((await request({ goal: 'Plan my day' }, { MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'test-only' })).status, 503)
})
for (const provider of ['groq', 'ollama', 'openai'] as const) {
  test(`${provider} sends context and previous UI using the correct transport`, async () => {
    const env = provider === 'groq' ? groq : provider === 'ollama' ? { MODEL_PROVIDER: 'ollama', OLLAMA_MODEL: 'local-model' } : { MODEL_PROVIDER: 'openai', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'test-model' }
    await withFetch(async (url, options) => {
      const payload = JSON.parse(String(options?.body)), responses = provider === 'openai'
      assert.equal(String(url), provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : responses ? 'https://api.openai.com/v1/responses' : 'http://127.0.0.1:11434/v1/chat/completions')
      assert.equal(payload.stream, false)
      const messages = responses ? payload.input : payload.messages.slice(1)
      assert.equal(messages[0].content, ui)
      assert.equal(messages[1].content, 'Add calendar')
      assert.match(responses ? payload.instructions : payload.messages[0].content, /audit-task/)
      return Response.json(responses ? { output: [{ content: [{ type: 'output_text', text: ui }] }] } : { choices: [{ message: { content: ui } }] })
    }, async () => {
      const result = await request({ goal: 'Add calendar', previousUI: ui, context: { tasks: [{ id: 'audit-task' }] } }, env)
      assert.equal(result.status, 200); assert.equal(result.body.response, ui)
    })
  })
}
for (const status of [401, 429, 500]) test(`upstream ${status} returns an error without fallback UI`, async () => {
  await withFetch(async () => new Response('', { status }), async () => assert.equal((await request({ goal: 'Plan my day' }, groq)).status, status))
})
test('network failure returns 502', async () => {
  await withFetch(async () => { throw new TypeError('mock network failure') }, async () => assert.equal((await request({ goal: 'Plan my day' }, groq)).status, 502))
})
test('empty output returns 502', async () => {
  await withFetch(async () => Response.json({ choices: [] }), async () => assert.equal((await request({ goal: 'Plan my day' }, groq)).status, 502))
})
test('audit finding: backend returns invalid UI text with status 200', async () => {
  await withFetch(async () => Response.json({ choices: [{ message: { content: 'Invalid UI prose' } }] }), async () => {
    const result = await request({ goal: 'Plan my day' }, groq)
    assert.equal(result.status, 200); assert.equal(result.body.response, 'Invalid UI prose')
  })
})
test('audit finding: JSON null returns 502 instead of 400', async () => assert.equal((await request(null)).status, 502))
