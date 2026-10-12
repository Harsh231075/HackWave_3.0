import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mongoModels, modelSchemas, mongoConnectionState } from '../src/models/index.ts'
import { parseEntity, type EntityType } from '../src/models/contracts.ts'

const samples:Record<EntityType,unknown>={
  tasks:{title:'Prepare demo',owner:'Alex',due:'2026-10-12'},
  events:{title:'Review',date:'2026-10-13',start:'10:00',end:'11:00'},
  notes:{title:'Review notes'},resources:{title:'Product brief'},
  attachments:{name:'brief.pdf',mimeType:'application/pdf',size:1024,storageKey:'local/brief.pdf'},
  links:{sourceType:'tasks',sourceId:'task-a',targetType:'resources',targetId:'resource-a'},
  issues:{title:'Release blocker',owner:'Alex'},
  communications:{subject:'Review agenda',sender:'Alex',date:'2026-10-12'},
  'usage-observations':{date:'2026-10-12',segment:'web',sessions:40},
  'usage-releases':{title:'Onboarding update',date:'2026-10-12'},
  'plugin-settings':{pluginId:'mail',enabled:true},
  'voice-notes':{noteId:'note-a',attachmentId:'attachment-a',durationMs:1200},
  workspaces:{title:'Meeting prep'},
  activity:{operation:'create',entityType:'tasks',entityId:'task-a',summary:'Task created',at:'2026-10-12T00:00:00.000Z'},
}
for(const [entity,sample] of Object.entries(samples))test(`${entity} model validates without connecting to MongoDB`,async()=>{
  const data=parseEntity(entity as EntityType,sample)
  const document=new mongoModels[entity]({...data,id:`test-${entity}`,revision:1,createdAt:new Date(),updatedAt:new Date()})
  await document.validate()
  assert.equal(mongoConnectionState(),0)
})
test('invalid fields and forged metadata are rejected',()=>{
  assert.throws(()=>parseEntity('tasks',{...samples.tasks as object,status:'invented'}))
  assert.throws(()=>parseEntity('tasks',{...samples.tasks as object,duration:1}))
  assert.throws(()=>parseEntity('tasks',{...samples.tasks as object,revision:99}))
  assert.throws(()=>parseEntity('tasks',{...samples.tasks as object,due:'2026-02-31'}))
})
test('events, resource URLs and workspace context have cross-field validation',()=>{
  assert.throws(()=>parseEntity('events',{...samples.events as object,end:'09:00'}),/end must follow/)
  assert.throws(()=>parseEntity('resources',{title:'Unsafe link',kind:'link',body:'javascript:alert(1)'}),/HTTP/)
  assert.throws(()=>parseEntity('workspaces',{title:'Workspace',components:[],context:{goal:'Tasks',targetInstanceIds:['missing']}}),/targets/)
  assert.throws(()=>parseEntity('workspaces',{title:'Workspace',components:[{instanceId:'same',widgetType:'tasks'},{instanceId:'same',widgetType:'calendar'}]}),/unique/)
})
test('model schemas declare uniqueness and relevant lookup indexes',()=>{
  assert.equal(Object.keys(modelSchemas).length,14)
  assert.ok(modelSchemas['usage-observations'].indexes().some(([fields,options])=>fields.date===1&&fields.segment===1&&options.unique))
  assert.ok(modelSchemas['plugin-settings'].indexes().some(([fields,options])=>fields.pluginId===1&&options.unique))
})
test('nested workspace content is validated by the Mongo model as well',async()=>{
  const document=new mongoModels.workspaces({title:'Workspace',components:[{instanceId:'a',widgetType:'invented'}],context:{goal:'',targetInstanceIds:[]},id:'w',revision:1,createdAt:new Date(),updatedAt:new Date()})
  await assert.rejects(document.validate())
})
