import test from 'node:test'
import assert from 'node:assert/strict'
import { widgetTypes } from '../src/lib/workspace/config.ts'
import { arrangeWidgetRows, chooseLayoutVersion, layoutVariantSchema, normalizeLayoutRows, widgetLayoutCatalog } from '../src/domain/widgetLayout.ts'
import { makeInstance, widgetSelectionKey } from '../src/domain/widgetInstances.ts'
import { applyInstanceOperations, emptyWorkspace, commitWorkspace, TargetError, workspaceDocumentSchema } from '../src/domain/workspaceDocument.ts'
import { localManagement } from '../src/domain/workspaceManagement.ts'
import { componentRequestSchema, validateComponentResolution } from '../src/domain/componentIntent.ts'
import { componentModelInput } from './componentModelIntent.ts'
const create = (type: typeof widgetTypes[number]) => makeInstance(type)
const metric = (width: number) => ({width,height:760,gap:24,allowVerticalScroll:true as const})

test('every registered widget declares valid unique versions and small tools have one version', () => {
  for (const type of widgetTypes) {
    const versions = widgetLayoutCatalog[type]
    assert.ok(versions.length)
    assert.equal(new Set(versions.map(v=>v.version)).size,versions.length)
    for (const version of versions) assert.ok(layoutVariantSchema.safeParse(version).success)
  }
  for (const type of ['quick-timer','calculator'] as const) assert.equal(widgetLayoutCatalog[type].length,1)
})
test('versions are supported per widget and sizing compares compatible footprints', () => {
  const task = {...create('tasks'),layoutVersion:2}
  assert.equal(chooseLayoutVersion(task,'smaller'),1)
  assert.equal(chooseLayoutVersion({...task,layoutVersion:1},'larger'),2)
  assert.throws(()=>chooseLayoutVersion(create('quick-timer'),'smaller'),/No smaller/)
  assert.throws(()=>chooseLayoutVersion(create('quick-timer'),2),/not available/)
})
test('rows remain within bounds, wrap at usable minima, and tools do not stretch', () => {
  const instances=[create('quick-timer'),create('tasks'),create('calculator')]
  const rows=[instances.map(i=>i.instanceId)]
  for(const width of [180,390,760,1180,1800]){
    const cells=arrangeWidgetRows(instances,rows,metric(width))
    for(const cell of cells){
      assert.ok(cell.column>=1&&cell.column+cell.columns<=13)
      assert.ok(cell.width>=0&&cell.width<=width)
    }
    for(let a=0;a<cells.length;a++)for(let b=a+1;b<cells.length;b++)if(cells[a].row===cells[b].row)assert.ok(cells[a].column+cells[a].columns<=cells[b].column)
    assert.ok(cells[0].width<=340)
    assert.ok(cells[2].width<=360)
  }
  assert.deepEqual(arrangeWidgetRows(instances,rows,metric(390)).map(c=>c.row),[1,2,3])
  assert.equal(arrangeWidgetRows(instances,rows,metric(1180))[1].row,1)
})
test('Kanban keeps its selected view and imposes a wider usable minimum', () => {
  const task={...create('tasks'),viewState:{...create('tasks').viewState,taskView:'kanban' as const}}
  const timer=create('quick-timer'), rows=[[timer.instanceId,task.instanceId]]
  assert.equal(arrangeWidgetRows([timer,task],rows,metric(760))[1].row,2)
  assert.equal(arrangeWidgetRows([timer,task],rows,metric(1180))[1].variant.minWidth,620)
  assert.equal(task.viewState.taskView,'kanban')
})
test('moves use rows, include pins, and resizing preserves record selection and state', () => {
  const timer=create('quick-timer'),task=create('tasks'),note=create('outline')
  const pin={...note,pinId:'pin',createdAt:new Date().toISOString()}
  const document={...emptyWorkspace(),active:[timer,task],pins:[pin]}
  const moved=applyInstanceOperations(document,[{type:'move',widget:timer.instanceId,position:'left-of',relativeTo:task.instanceId},{type:'move',widget:note.instanceId,position:'first'}],create)
  assert.deepEqual(moved.rows,[[note.instanceId],[timer.instanceId,task.instanceId]])
  assert.equal(moved.pins[0].pinId,'pin')
  const resized=applyInstanceOperations(moved,[{type:'resize',widget:task.instanceId,version:2}],create)
  assert.equal(resized.active.find(i=>i.instanceId===task.instanceId)!.layoutVersion,2)
  assert.deepEqual(resized.active.find(i=>i.instanceId===task.instanceId)!.viewState,task.viewState)
  assert.equal(widgetSelectionKey(task),widgetSelectionKey(resized.active.find(i=>i.instanceId===task.instanceId)!))
  assert.deepEqual(resized.rows,moved.rows)
})
test('pin/unpin commits keep position and row normalization prunes removed IDs', () => {
  const task=create('tasks'),note=create('outline')
  const document=commitWorkspace(emptyWorkspace(),{active:[task,note]})
  const pinned=commitWorkspace(document,{active:[task],pins:[{...note,pinId:'pin',createdAt:new Date().toISOString()}]})
  assert.deepEqual(pinned.rows,document.rows)
  assert.deepEqual(commitWorkspace(pinned,{active:[task,note],pins:[]}).rows,document.rows)
  assert.deepEqual(normalizeLayoutRows([task],[[note.instanceId,task.instanceId]]),[[task.instanceId]])
})
test('invalid, unavailable and ambiguous changes fail atomically', () => {
  const task=create('tasks'),other=create('tasks'),timer=create('quick-timer')
  const document={...emptyWorkspace(),active:[task,other,timer]}
  const before=JSON.stringify(document)
  assert.throws(()=>applyInstanceOperations(document,[{type:'move',widget:timer.instanceId,position:'first'},{type:'resize',widget:timer.instanceId,version:2}],create))
  assert.throws(()=>applyInstanceOperations(document,[{type:'move',widget:'tasks',position:'first'}],create),TargetError)
  assert.throws(()=>applyInstanceOperations(document,[{type:'move',widget:task.instanceId,relativeTo:task.instanceId,position:'left-of'}],create))
  assert.equal(JSON.stringify(document),before)
})
test('natural management phrases choose versions and spatial relations', () => {
  assert.equal(localManagement('Make Tasks smaller')?.operations[0].type,'resize')
  assert.deepEqual(localManagement('Use Timer version 1')?.operations[0],{type:'resize',widget:'quick-timer',version:1})
  assert.deepEqual(localManagement('Put notes left side of tasks')?.operations[0],{type:'move',widget:'outline',relativeTo:'tasks',position:'left-of'})
  assert.deepEqual(localManagement('Move it to the top')?.operations[0],{type:'move',widget:'@last',position:'first'})
})
test('legacy instances and spans normalize without losing records', () => {
  const task=create('tasks'),note=create('outline')
  delete task.layoutVersion
  const document=workspaceDocumentSchema.parse({...emptyWorkspace(),active:[{...task,span:'wide'}, {...note,span:'narrow'}]})
  assert.deepEqual(normalizeLayoutRows(document.active),[[task.instanceId,note.instanceId]])
  assert.equal(document.active[0].viewState.taskFilters.status,'all')
})
test('AI receives measured space and dimensions and rejects unsupported versions', () => {
  const timer=create('quick-timer')
  const input=componentRequestSchema.parse({goal:'Use timer version 2',referenceDate:'2026-10-12',timezone:'Asia/Kolkata',enabledExtensions:['quick-timer'],canvas:metric(1180),instances:[timer],catalog:{owners:[],topics:[],draftKeys:[]}})
  const model=componentModelInput(input)
  assert.equal(model.canvas?.width,1180)
  assert.ok(model.layoutCatalog['quick-timer'])
  const saved=model.savedViews?.[0]
  assert.ok(saved && 'layoutVersion' in saved)
  assert.equal(saved.layoutVersion,1)
  assert.equal(validateComponentResolution({action:'manage',operations:[{type:'resize',widget:timer.instanceId,version:2}],reply:'Updated'},input).success,false)
})
test('right-side placement anchors the cell to the right edge', () => {
  const timer=create('quick-timer')
  const document=applyInstanceOperations({...emptyWorkspace(),active:[timer]},[{type:'move',widget:timer.instanceId,position:'right'}],create)
  const cell=arrangeWidgetRows(document.active,document.rows,metric(1180))[0]
  assert.equal(cell.column+cell.columns,13)
})
test('replacement reuses its former row and imported widgets honor declared versions', () => {
  const task=create('tasks'),note=create('outline')
  const document=applyInstanceOperations({...emptyWorkspace(),active:[task,note],rows:[[task.instanceId,note.instanceId]]},[{type:'replace',widgets:[task.instanceId],with:['calendar']}],create)
  assert.equal(document.rows?.[0][1],note.instanceId)
  assert.equal(document.rows?.length,1)
  const external={...create('external-plugin'),externalLayoutVariants:widgetLayoutCatalog.tasks}
  assert.equal(chooseLayoutVersion(external,2),2)
})
