import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createProjectDataService, emptyRecords, freshProjectData } from '../src/services/projectDataService.ts'
import { createProjectSeedService } from '../src/services/projectSeedService.ts'
import { createTaskService } from '../src/services/taskService.ts'
import { createEventService } from '../src/services/eventService.ts'
import { createDraftService } from '../src/services/draftService.ts'
import { createAdaptiveDataService } from '../src/services/adaptiveDataService.ts'
import { createUsageWorkspaceService } from '../src/services/usageWorkspaceService.ts'
import { createUsageDataService } from '../src/services/usageDataService.ts'
import { createOverdueReviewService } from '../src/services/overdueReviewService.ts'
import { workspaceDocumentStore } from '../src/services/workspaceDocumentStore.ts'
import { createNoteService } from '../src/services/noteService.ts'
import { createResourceModuleService } from '../src/services/resourceModuleService.ts'
import { getActivityRecords } from '../src/services/recordHistory.ts'
import { plannerSummary } from '../src/domain/plannerTime.ts'
import { shiftDate } from '../src/domain/calendar.ts'
import { loadActionScope } from '../src/services/actionScope.ts'
const today = '2026-10-11'
function setup() {
  const raw = new Map<string, string>()
  const storage = createBrowserStorage(() => ({ getItem: key => raw.get(key) ?? null, setItem: (key,value) => raw.set(key,value), removeItem: key => raw.delete(key) }))
  const database = createBrowserDatabase(storage, emptyRecords(), freshProjectData(), true)
  const projects = createProjectDataService(database)
  return { raw, storage, database, projects }
}
const task = { title:'A task', description:'', owner:'Me', due:today, duration:30, priority:'medium' as const, status:'pending' as const }
test('fresh local data contains an empty Default project and project-bound dashboard; names do not determine identity', () => {
  const { database, projects } = setup()
  const id = projects.selectedId()!
  assert.equal(projects.projects.list().length,1)
  assert.equal(database.getState().tasks.length,0)
  assert.equal(database.getState().events.length,0)
  assert.equal(projects.clients.list().length,0)
  assert.equal(projects.delete(id).ok,false)
  assert.equal(projects.projects.update(id,{name:'My personal project'}).ok,true)
  assert.equal(projects.settings()?.defaultProjectId,id)
  const reload=createBrowserDatabase(database.storage,emptyRecords(),freshProjectData(),true)
  assert.equal(createProjectDataService(reload).selectedId(),id)
  assert.ok(workspaceDocumentStore(database).getSnapshot().document.active.every(widget => widget.binding.kind==='workspace' && widget.binding.projectId===id))
})
test('tasks, meetings and notes require valid projects, with optional client and one agenda body', () => {
  const { database, projects } = setup(), projectId=projects.selectedId()!
  const tasks=createTaskService(database,()=>today), events=createEventService(database), drafts=createDraftService(database)
  assert.equal(tasks.save(task).ok,false)
  assert.equal(tasks.save({...task,projectId:'missing'}).ok,false)
  assert.equal(tasks.save({...task,projectId}).ok,true)
  const saved=events.create({projectId,title:'Planning',date:'2026-10-12',start:'10:00',end:'11:00',category:'meeting',participants:[],agenda:'First agenda'})
  assert.ok(saved.ok)
  const preparation=createAdaptiveDataService(database).loadPreparation(saved.value.id)
  assert.equal(preparation.status,'found')
  if(preparation.status==='found'){assert.equal(preparation.value.client,null);assert.equal(preparation.value.tasks.length,1)}
  assert.equal(database.getState().events[0].agenda,'')
  assert.equal(drafts.save(`meeting-agenda:${saved.value.id}`,'Updated agenda').ok,true)
  assert.equal(events.getById(saved.value.id)?.agenda,'Updated agenda')
  assert.equal(createAdaptiveDataService(database).loadPreparation(saved.value.id).status,'found')
  const note=projects.notes.create(projectId,'Planning notes','Body');assert.ok(note.ok)
  assert.equal(projects.notes.rename(note.value.id,'Renamed').ok,true)
  assert.equal(drafts.get(note.value.draftKey),'Body')
  assert.equal(projects.notes.delete(note.value.id).ok,true)
  assert.equal(drafts.get(note.value.draftKey),null)
  assert.equal(drafts.save('outline','Orphan').ok,false)
})
test('project membership supports multiple clients and deactivation retains historical meeting scope', () => {
  const { database, projects } = setup(), projectId=projects.selectedId()!
  const a=projects.clients.create({name:'A',description:'',email:'a@example.com'}), b=projects.clients.create({name:'B',description:'',phone:'123'})
  assert.ok(a.ok&&b.ok)
  assert.ok(projects.addClient(projectId,a.value.id).ok)
  assert.ok(projects.addClient(projectId,b.value.id).ok)
  const events=createEventService(database)
  const meeting=events.create({projectId,clientId:a.value.id,title:'Review',date:today,start:'10:00',end:'11:00',category:'meeting',participants:[],agenda:''});assert.ok(meeting.ok)
  assert.ok(projects.removeClient(projectId,a.value.id).ok)
  assert.equal(projects.clientLinks(projectId).length,1)
  assert.equal(createAdaptiveDataService(database).loadPreparation(meeting.value.id).status,'found')
  assert.equal(events.create({projectId,clientId:a.value.id,title:'New review',date:'2026-10-12',start:'10:00',end:'11:00',category:'meeting',participants:[],agenda:''}).ok,false)
})
test('explicit seed installs linked runtime IDs, derives usage and overdue results, and never overwrites records', () => {
  const { database, projects } = setup(), seed=createProjectSeedService(database,()=>today)
  assert.ok(seed.seed().ok)
  const data=createAdaptiveDataService(database).snapshot()!;assert.ok(data)
  assert.equal(projects.projects.list().length,3)
  assert.equal(data.meetings.length,12)
  assert.equal(data.projects[1].clientIds?.length,1)
  const projectId=projects.selectedId()!, meeting=data.meetings.find(record=>record.projectId===projectId && record.date==='2026-10-12')!
  const preparation=createAdaptiveDataService(database).loadPreparation(meeting.id);assert.equal(preparation.status,'found')
  if(preparation.status==='found'){assert.equal(preparation.value.tasks.length,8);assert.equal(preparation.value.resources.length,4)}
  const scope=loadActionScope(database,{kind:'workspace',projectId});assert.equal(scope?.tasks.length,8)
  const usage=createUsageWorkspaceService(database).load({goalType:'usage_investigation',projectId,dateRange:{from:'2026-09-28',to:today}})
  assert.equal(usage.status,'found')
  if(usage.status==='found'){assert.equal(usage.value.snapshot.tasks.length,8);assert.equal(usage.value.observations.length,28);assert.ok(Math.abs(usage.value.periodComparisons.find(row=>row.segment==='mobile')!.currentAverage! - 85) < 0.000001)}
  const overdue=createOverdueReviewService(database).load({goalType:'overdue_review',projectId,dateRange:{from:'0001-01-01',to:today}},today)
  assert.equal(overdue.status,'found');if(overdue.status==='found')assert.equal(overdue.value.tasks.length,2)
  assert.equal(seed.seed().ok,false)
  assert.equal(projects.delete(projectId).ok,false)
})
test('reset removes old local data, layouts, pins, undo and preferences while preserving unrelated storage', () => {
  const { raw, database, projects }=setup()
  const store=workspaceDocumentStore(database), before=store.getSnapshot().document
  store.save({...before,active:[]})
  raw.set('gogpt-app-layout-v1','old');raw.set('orlo-workspace-conversation-v1','old');raw.set('calendar-view','week');raw.set('external-calendar-session','keep')
  createTaskService(database,()=>today).save({...task,projectId:projects.selectedId()})
  const epoch=database.getEpoch();assert.equal(projects.reset().status,'saved')
  assert.equal(database.getEpoch(),epoch+1)
  assert.equal(raw.has('gogpt-app-layout-v1'),false)
  assert.equal(raw.has('orlo-workspace-conversation-v1'),false)
  assert.equal(raw.has('calendar-view'),false)
  assert.equal(raw.get('external-calendar-session'),'keep')
  assert.equal(database.getState().tasks.length,0)
  assert.equal(database.getState().history.length,0)
  assert.equal(store.getSnapshot().undo.length,0)
  assert.equal(store.getSnapshot().document.pins.length,0)
  store.undo();assert.ok(store.getSnapshot().document.active.length)
  const reload=createBrowserDatabase(database.storage,emptyRecords(),freshProjectData(),true)
  assert.equal(reload.getState().tasks.length,0)
  assert.equal(createProjectDataService(reload).projects.list().length,1)
})
test('legacy storage is blocked and preserved until Reset; corrupt task storage is not silently replaced', () => {
  const { raw,storage }=setup()
  raw.set('gogpt-workspace-v1','{')
  raw.set('orlo-browser-db-v1',JSON.stringify({version:1,collections:{projects:[{id:'old',name:'Old'}]}}))
  const database=createBrowserDatabase(storage,emptyRecords(),freshProjectData(),true), projects=createProjectDataService(database)
  assert.equal(projects.compatible(),false)
  assert.equal(projects.create('New').ok,false)
  assert.equal(raw.get('gogpt-workspace-v1'),'{')
  assert.equal(projects.reset().status,'saved')
  assert.equal(projects.compatible(),true)
  assert.equal(createUsageDataService(database).snapshot()?.observations.length,0)
})

test('expanded seed populates calendar, planner and note/resource views with linked date-relative data', () => {
  for (const anchor of [today, '2027-01-02']) {
    const { database, projects } = setup()
    assert.ok(createProjectSeedService(database, () => anchor).seed().ok)
    const adaptive = createAdaptiveDataService(database), data = adaptive.snapshot()!, notes = createNoteService(database), resources = createResourceModuleService(database)
    const state = database.getState()
    assert.equal(state.events.length, 20)
    assert.equal(state.tasks.length, 16)
    assert.equal(getActivityRecords(database).length, 4)
    assert.ok(getActivityRecords(database).every(record => state.tasks.some(task => task.id === record.entityId && task.status === 'completed') && record.summary.startsWith('Sample history:')))
    for (const project of projects.projects.list().filter(project => project.id !== projects.settings()!.defaultProjectId)) {
      const tasks = state.tasks.filter(task => task.projectId === project.id)
      assert.deepEqual(new Set(tasks.map(task => task.status)), new Set(['pending', 'blocked', 'completed']))
      assert.deepEqual(new Set(tasks.map(task => task.priority)), new Set(['urgent', 'high', 'medium', 'low']))
      assert.ok(tasks.some(task => task.due === anchor))
      assert.ok(tasks.some(task => task.due > anchor))
      const events = state.events.filter(event => event.projectId === project.id)
      assert.ok(events.some(event => event.date === shiftDate(anchor, -7)))
      assert.ok(events.some(event => event.date === shiftDate(anchor, 1)))
      assert.ok(events.some(event => event.date === shiftDate(anchor, 8)))
      assert.deepEqual(new Set(events.map(event => event.category)), new Set(['meeting', 'focus', 'break', 'class']))
      const summary = plannerSummary(events.filter(event => event.date === anchor), [], anchor, 'Asia/Kolkata')
      assert.deepEqual(summary, { meetingMinutes: 75, focusMinutes: 105, freeMinutes: 330 })
      const projectNotes = notes.list(project.id)
      assert.equal(projectNotes.length, 10)
      assert.ok(projectNotes.some(note => note.pinned && notes.canDelete(note)))
      assert.ok(projectNotes.some(note => note.kind === 'investigation'))
      assert.ok(projectNotes.every(note => note.body && note.createdAt && note.updatedAt))
      for (const meeting of data.meetings.filter(meeting => meeting.projectId === project.id)) {
        assert.ok(state.events.some(event => event.id === meeting.eventId && event.projectId === meeting.projectId))
        assert.ok(projectNotes.some(note => note.meetingId === meeting.id && note.body === meeting.agenda))
        assert.equal(adaptive.loadPreparation(meeting.id).status, 'found')
      }
      assert.ok(data.meetings.some(meeting => meeting.projectId === project.id && !meeting.clientId))
      const review = data.meetings.find(meeting => meeting.projectId === project.id && meeting.date === shiftDate(anchor, 1))!
      const preparation = adaptive.loadPreparation(review.id)
      assert.equal(preparation.status, 'found')
      if (preparation.status === 'found') {
        assert.equal(preparation.value.communications.length, 4)
        assert.equal(preparation.value.issues.length, 2)
        assert.equal(preparation.value.previousMeeting?.date, shiftDate(anchor, -7))
      }
      const projectResources = data.resources.filter(resource => resource.projectId === project.id)
      assert.equal(projectResources.length, 4)
      assert.deepEqual(new Set(projectResources.map(resource => resource.kind)), new Set(['document', 'note', 'link']))
      for (const resource of projectResources) {
        assert.ok(resources.properties(resource.id).tags.length)
        assert.ok(resources.properties(resource.id).links.every(link => link.kind === 'task' ? tasks.some(task => task.id === link.id) : data.meetings.some(meeting => meeting.id === link.id && meeting.projectId === project.id)))
      }
    }
    assert.equal(state.events.some(event => event.id.startsWith('google:')), false)
    const before = structuredClone(state)
    assert.equal(createProjectSeedService(database, () => anchor).seed().ok, false)
    assert.deepEqual(database.getState(), before)
  }
})
