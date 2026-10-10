import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { chat } from './chat.ts'

test('validates goals and generates UI through the server OpenAI endpoint', async () => {
  const env: NodeJS.ProcessEnv = {}
  const server = createServer((req, res) => { void chat(req, res, env) })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')
  const url = `http://127.0.0.1:${address.port}`
  const original = globalThis.fetch
  const post = (body: unknown) => original(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  try {
    assert.equal((await post({ goal: '' })).status, 400)
    assert.equal((await post({ goal: 'Plan my day' })).status, 503)
    env.OPENAI_API_KEY = 'test-only'; env.OPENAI_MODEL = 'test-model'
    globalThis.fetch = async (input, options) => {
      assert.equal(String(input), 'https://api.openai.com/v1/responses')
      const payload = JSON.parse(String(options?.body))
      assert.equal(payload.model, 'test-model'); assert.equal(payload.stream, false)
      assert.ok(payload.instructions.includes('WorkspaceWidget'))
      assert.equal(payload.input.at(-1).content, 'Plan my day')
      return Response.json({ output: [{ content: [{ type: 'output_text', text: 'root = Card([Workspace([WorkspaceWidget("tasks", "full")])])' }] }] })
    }
    const response = await post({ goal: 'Plan my day', context: { projects: ['Northstar'] } })
    assert.equal(response.status, 200)
    const body = await response.json() as { response: string }
    assert.match(body.response, /WorkspaceWidget/)
  } finally { globalThis.fetch = original; server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
})
