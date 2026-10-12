import test from 'node:test'
import assert from 'node:assert/strict'
import { modelText, resolveProvider } from './modelProvider.ts'

test('custom endpoints and models come from the environment', () => {
  const config = resolveProvider({ OPENAI_BASE_URL: 'https://provider.example/v1///', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'any-model' })
  assert.equal(config.base, 'https://provider.example/v1')
  assert.equal(config.format, 'chat')
  assert.equal(config.model, 'any-model')
  assert.equal(config.key, 'test-only')
  assert.equal(resolveProvider({}).format, 'chat')
  assert.equal(resolveProvider({ OPENAI_BASE_URL: 'http://localhost:8080/v1' }).base, 'http://localhost:8080/v1')
  assert.equal(resolveProvider({ OPENAI_BASE_URL: 'https://provider.example/v1', MODEL_API_FORMAT: 'responses' }).format, 'responses')
})

test('invalid transport configuration is rejected', () => {
  assert.throws(() => resolveProvider({ MODEL_API_FORMAT: 'invalid' }), /MODEL_API_FORMAT/)
  for (const base of ['file:///tmp/api', 'https://provider.example/v1?key=private', 'https://user:password@provider.example/v1']) assert.throws(() => resolveProvider({ OPENAI_BASE_URL: base }), /BASE_URL/)
})

test('chat requests use configured endpoint, bearer key and changed model', async () => {
  const original = globalThis.fetch
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  globalThis.fetch = (async (url, init) => {
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer test-only')
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return Response.json({ choices: [{ message: { content: 'result' } }] })
  }) as typeof fetch
  try {
    const env = { OPENAI_BASE_URL: 'https://provider.example/v1', OPENAI_API_KEY: 'test-only', OPENAI_MODEL: 'first-model', MODEL_API_FORMAT: 'chat' }
    assert.equal(await modelText(env, 'instructions', [{ role: 'user', content: 'goal' }], new AbortController().signal), 'result')
    env.OPENAI_MODEL = 'second-model'
    await modelText(env, 'instructions', [{ role: 'user', content: 'goal' }], new AbortController().signal, true)
    assert.equal(calls[0].url, 'https://provider.example/v1/chat/completions')
    assert.equal(calls[0].body.model, 'first-model')
    assert.equal(calls[1].body.model, 'second-model')
    assert.equal(calls[1].body.response_format, undefined)
  } finally { globalThis.fetch = original }
})
