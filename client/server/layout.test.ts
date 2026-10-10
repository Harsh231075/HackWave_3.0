import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearLayout, layoutStorageKey, readLayout, saveLayout, type LayoutStorage } from '../src/lib/workspace/layoutPersistence.ts'

const response = 'root = Card([Workspace([WorkspaceWidget("tasks", "full")])])'
const validate = (value: string) => value === response
function memoryStorage() {
  const data = new Map<string, string>([['gogpt-workspace-v1', 'existing-records']])
  const storage: LayoutStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value) },
    removeItem: key => { data.delete(key) },
  }
  return { data, storage, source: () => storage }
}

test('layout persistence round-trips only the layout and preserves workspace records', () => {
  const { source, data } = memoryStorage()
  assert.deepEqual(readLayout(source, validate), { status: 'missing' })
  assert.equal(saveLayout(source, response), true)
  assert.deepEqual(JSON.parse(data.get(layoutStorageKey)!), { version: 1, response })
  assert.deepEqual(readLayout(source, validate), { status: 'saved', response })
  assert.equal(clearLayout(source), true)
  assert.deepEqual(readLayout(source, validate), { status: 'missing' })
  assert.equal(data.get('gogpt-workspace-v1'), 'existing-records')
})

test('malformed, incompatible, or rejected layouts fall back without modifying storage', () => {
  const { source, data } = memoryStorage()
  for (const raw of ['{', 'null', '{}', JSON.stringify({ version: 2, response }), JSON.stringify({ version: 1, response: '' }), JSON.stringify({ version: 1, response: 2 }), JSON.stringify({ version: 1, response: 'invalid' }), JSON.stringify({ version: 1, response, componentState: { text: 'private' } })]) {
    data.set(layoutStorageKey, raw)
    assert.deepEqual(readLayout(source, validate), { status: 'invalid' })
    assert.equal(data.get(layoutStorageKey), raw)
  }
  saveLayout(source, response)
  assert.deepEqual(readLayout(source, () => { throw new Error('parser failed') }), { status: 'invalid' })
})

test('storage acquisition, read, write, and removal failures do not throw or erase the saved layout', () => {
  const brokenSource = () => { throw new Error('blocked storage') }
  assert.deepEqual(readLayout(brokenSource, validate), { status: 'unavailable' })
  assert.equal(saveLayout(brokenSource, response), false)
  assert.equal(clearLayout(brokenSource), false)
  const { source, storage, data } = memoryStorage()
  saveLayout(source, response)
  const original = data.get(layoutStorageKey)
  storage.getItem = () => { throw new Error('read denied') }
  assert.deepEqual(readLayout(source, validate), { status: 'unavailable' })
  storage.setItem = () => { throw new Error('quota exceeded') }
  assert.equal(saveLayout(source, 'replacement'), false)
  assert.equal(data.get(layoutStorageKey), original)
  storage.removeItem = () => { throw new Error('remove denied') }
  assert.equal(clearLayout(source), false)
  assert.equal(data.get(layoutStorageKey), original)
  assert.equal(data.get('gogpt-workspace-v1'), 'existing-records')
})

test('invalid values cannot overwrite the previous saved layout', () => {
  const { source, data } = memoryStorage()
  saveLayout(source, response)
  const original = data.get(layoutStorageKey)
  assert.equal(saveLayout(source, ''), false)
  assert.equal(data.get(layoutStorageKey), original)
})
