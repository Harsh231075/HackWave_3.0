import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createTaskService } from '../src/services/taskService.ts'
import { createEventService } from '../src/services/eventService.ts'
import { createDraftService } from '../src/services/draftService.ts'
import { createAnalyticsService } from '../src/services/analyticsService.ts'
import { createActivityService } from '../src/services/activityService.ts'
import { createAvailabilityService } from '../src/services/availabilityService.ts'
import { createSearchService } from '../src/services/searchService.ts'
import { createResourceService } from '../src/services/resourceService.ts'
import { createProfileService } from '../src/services/profileService.ts'
import { createNotificationService } from '../src/services/notificationService.ts'
import { createAuthService } from '../src/services/authService.ts'
import { createSharingService } from '../src/services/sharingService.ts'
import { createCalendarIntegrationService } from '../src/services/calendarIntegrationService.ts'
import { createFileService } from '../src/services/fileService.ts'
import { createRecommendationService } from '../src/services/recommendationService.ts'
const seed = { tasks: [], events: [], drafts: {}, dismissed: [], activity: [] }
function setup() {
  const data = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: key => { data.delete(key) } }))
  const database = createBrowserDatabase(storage, seed)
  return { data, storage, database }
}
const input = { title: 'Plan project', description: 'Research', owner: 'Maya', due: '2026-10-12', duration: 30, priority: 'medium' as const, status: 'pending' as const }
test('all domain services share one database, subscriptions, persistence, filters, and undo', () => {
  const { database, storage } = setup()
  let updates = 0
  const unsubscribe = database.subscribe(() => { updates++ })
  const tasks = createTaskService(database, () => '2026-10-12', () => 'task')
  assert.equal(tasks.create(input).ok, true)
  const copy = tasks.list(); copy[0].title = 'Mutated'
  assert.equal(tasks.getById('task')?.title, input.title)
  assert.equal(tasks.list({ query: 'not matching' }).length, 0)
  const analytics = createAnalyticsService(database)
  assert.equal(analytics.getTaskSummary().open, 1)
  const events = createEventService(database, () => 'event')
  assert.equal(events.create({ title: 'Meeting', date: '2026-10-12', start: '10:00', end: '11:00', category: 'meeting', participants: [], agenda: '' }).ok, true)
  assert.equal(events.list({ category: 'focus' }).length, 0)
  const availability = createAvailabilityService(database)
  assert.equal(availability.isAvailable({ date: '2026-10-12', start: '10:30', end: '11:30' }), false)
  assert.equal(availability.findSlots({ date: '2026-10-12', from: '10:00', to: '12:00' }).some(slot => slot.start === '11:00'), true)
  assert.equal(availability.findSlots({ date: '2026-10-12', step: 0 }).length, 0)
  const resources = createResourceService([], database)
  const search = createSearchService(database, resources)
  assert.equal(search.search('Research').tasks[0].id, 'task')
  assert.equal(createActivityService(database).list({ limit: 1 }).length, 1)
  const drafts = createDraftService(database)
  drafts.save('outline', 'Notes'); drafts.delete('outline')
  database.dispatch({ type: 'undo' }); assert.equal(drafts.get('outline'), 'Notes')
  tasks.delete('task'); database.dispatch({ type: 'undo' }); assert.equal(tasks.getById('task')?.id, 'task')
  events.delete('event'); database.dispatch({ type: 'undo' }); assert.equal(events.getById('event')?.id, 'event')
  assert.equal(createBrowserDatabase(storage, seed).getState().tasks[0].id, 'task')
  assert.equal(createBrowserDatabase(storage, seed).getState().history.length, 0)
  assert.ok(updates >= 8); unsubscribe()
})
test('database loading preserves invalid records; memory changes remain usable with blocked storage', () => {
  const { data, storage, database } = setup()
  data.set('orlo-data-v2', '{')
  database.getState(); database.dispatch({ type: 'filters', patch: { query: 'hello' } })
  assert.equal(data.get('orlo-data-v2'), '{')
  assert.equal(database.replaceRecords({ ...seed, tasks: [{}] } as never).status, 'invalid')
  data.set('orlo-browser-db-v2', '{')
  assert.equal(database.writeCollection('profiles', []).status, 'invalid')
  assert.equal(data.get('orlo-browser-db-v2'), '{')
  const blocked = createBrowserDatabase(createBrowserStorage(() => { throw new Error('blocked') }), seed)
  assert.equal(createTaskService(blocked, () => '2026-10-12').create(input).ok, true)
  assert.equal(blocked.getState().tasks.length, 1)
  assert.equal(blocked.getPersistenceResult().status, 'unavailable')
  assert.equal(storage.readJson('orlo-data-v2').status, 'invalid')
})
test('local profiles, notifications, sessions, and sharing persist in shared collections', () => {
  const { database, storage } = setup()
  const profiles = createProfileService(database)
  const result = profiles.create({ name: 'Maya', timezone: 'Asia/Kolkata' })
  assert.equal(result.ok, true)
  if (!result.ok) return
  const profile = result.value
  const auth = createAuthService(database, profiles)
  assert.equal(auth.signIn().ok, false)
  assert.equal(auth.selectLocalProfile(profile.id).ok, true)
  assert.equal(auth.getSession()?.mode, 'local')
  const sharing = createSharingService(database, profiles)
  sharing.addLocalMember(profile.id); sharing.addLocalMember(profile.id)
  assert.equal(sharing.listMembers().length, 1)
  assert.equal(sharing.invite().ok, false)
  const notifications = createNotificationService(database)
  const notification = notifications.create({ message: 'Remember', read: false, createdAt: new Date().toISOString() })
  if (notification.ok) notifications.markRead(notification.value.id)
  assert.equal(notifications.list()[0].read, true)
  notifications.updateSettings({ reminders: true })
  const reloaded = createBrowserDatabase(storage, seed)
  assert.equal(createProfileService(reloaded).getById(profile.id)?.name, 'Maya')
  assert.equal(createNotificationService(reloaded).getSettings().reminders, true)
  auth.signOut(); assert.equal(auth.getSession(), null)
})
test('calendar connections remain local metadata and attachments can be downloaded and deleted', async () => {
  const { database } = setup()
  const calendars = createCalendarIntegrationService(database)
  assert.equal(calendars.connect().ok, false)
  assert.equal(calendars.sync().ok, false)
  const connection = calendars.saveConnection({ provider: 'google', label: 'Personal', status: 'disconnected' })
  assert.equal(calendars.listConnections().length, 1)
  if (connection.ok) calendars.disconnect(connection.value.id)
  assert.equal(calendars.listConnections().length, 0)
  const files = createFileService(database)
  const uploaded = await files.upload(new Blob(['hello'], { type: 'text/plain' }), 'hello.txt')
  assert.equal(uploaded.ok, true)
  if (!uploaded.ok) return
  const url = files.getDownloadUrl(uploaded.value.id)
  assert.ok(url)
  assert.equal(await (await fetch(url)).text(), 'hello')
  files.revokeDownloadUrl(url)
  files.delete(uploaded.value.id); assert.equal(files.list().length, 0)
})
test('resources and recommendations use shared records rather than separate stores', () => {
  const { database } = setup()
  const resources = createResourceService([], database)
  const result = resources.create({ title: 'Doc', kind: 'doc', context: 'project', body: 'Details' })
  assert.equal(result.ok, true)
  if (result.ok) {
    resources.update(result.value.id, { title: 'Updated' })
    assert.equal(createSearchService(database, resources).search('Updated').resources.length, 1)
    resources.delete(result.value.id); assert.equal(resources.list().length, 0)
  }
  const tasks = createTaskService(database, () => '2026-10-12', () => 'task')
  tasks.create(input)
  const recommendations = createRecommendationService(database, () => '2026-10-12')
  assert.equal(recommendations.list()[0].taskId, 'task')
  assert.equal(recommendations.accept('task').ok, true)
  assert.equal(database.getState().events[0].id, 'recommendation-task')
  recommendations.dismiss('recommendation-task'); assert.equal(recommendations.list().length, 0)
})
