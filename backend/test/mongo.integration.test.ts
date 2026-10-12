import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { connectLocalMongo, disconnectMongo } from '../src/database.ts'
import { mongoose, mongoModels } from '../src/models/index.ts'
import { createApiHandler } from '../src/routes/api.ts'
import { createMongoRepository } from '../src/repositories/mongo.ts'

test('HTTP CRUD persists to local MongoDB and rejects stale/invalid writes',{skip:process.env.RUN_MONGO_TESTS!=='1'},async()=>{
  const database=`orlo_backend_test_${randomUUID().replaceAll('-','')}`
  await connectLocalMongo(`mongodb://127.0.0.1:27017/${database}`)
  const server=createServer(createApiHandler())
  try{
    await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve))
    const address=server.address();assert.ok(address&&typeof address!=='string')
    const origin=`http://127.0.0.1:${address.port}/api/v1`
    const request=(path:string,method='GET',value?:unknown,revision?:number)=>fetch(origin+path,{method,headers:{...(value!==undefined?{'Content-Type':'application/json'}:{}),...(revision!==undefined?{'If-Match':String(revision)}:{})},...(value!==undefined?{body:JSON.stringify(value)}:{})})
    const health=await(await request('/health')).json();assert.equal(health.storage,'mongodb');assert.equal(health.connected,true)
    assert.equal((await request('/tasks','POST',{title:'Invalid'})).status,422)
    const created=await request('/tasks','POST',{title:'Prepare demo',owner:'Alex',due:'2026-10-12'});assert.equal(created.status,201)
    const task=(await created.json()).data;assert.equal(task.revision,1);assert.equal(created.headers.get('etag'),'"1"')
    assert.equal(await mongoModels.tasks.countDocuments({id:task.id}),1)
    // A newly constructed repository sees the same database record, rather than process-local storage.
    assert.equal((await createMongoRepository().get('tasks',task.id)).title,'Prepare demo')
    assert.equal((await request(`/tasks/${task.id}`,'PATCH',{status:'completed'})).status,428)
    assert.equal((await request(`/tasks/${task.id}`,'PATCH',{revision:999},1)).status,422)
    const updates=await Promise.all([request(`/tasks/${task.id}`,'PATCH',{title:'First edit'},1),request(`/tasks/${task.id}`,'PATCH',{title:'Second edit'},1)])
    assert.deepEqual(updates.map(r=>r.status).sort(),[200,409])
    const saved=(await(await request(`/tasks/${task.id}`)).json()).data;assert.equal(saved.revision,2)
    assert.equal((await request(`/tasks/${task.id}`,'DELETE',undefined,1)).status,409)
    assert.equal((await request(`/tasks/${task.id}`,'DELETE',undefined,2)).status,204)
    assert.equal((await request(`/tasks/${task.id}`)).status,404)
    const resource=(await(await request('/resources','POST',{title:'Brief'})).json()).data
    const event=(await(await request('/events','POST',{title:'Review',date:'2026-10-13',start:'10:00',end:'11:00'})).json()).data
    assert.equal((await request('/notes','POST',{title:'Orphan',meetingId:'missing'})).status,404)
    const note=(await(await request('/notes','POST',{title:'Review notes',meetingId:event.id})).json()).data
    assert.equal((await request(`/events/${event.id}`,'DELETE',undefined,1)).status,409)
    assert.equal((await request('/links','POST',{sourceType:'resources',sourceId:resource.id,targetType:'notes',targetId:note.id})).status,201)
    assert.equal((await request(`/resources/${resource.id}`,'DELETE',undefined,1)).status,409)
    assert.equal((await request('/events','POST',{title:'Invalid',date:'2026-10-13',start:'11:00',end:'10:00'})).status,422)
    assert.equal((await request('/tasks?limit=0')).status,422)
    assert.equal((await request('/unknown')).status,404)
    assert.equal((await request('/activity','POST',{})).status,405)
    const plugin={pluginId:'mail',enabled:true}
    assert.equal((await request('/plugin-settings','POST',plugin)).status,201)
    assert.equal((await request('/plugin-settings','POST',plugin)).status,409)
    const observation={date:'2026-10-12',segment:'web',sessions:10}
    assert.equal((await request('/usage-observations','POST',observation)).status,201)
    assert.equal((await request('/usage-observations','POST',observation)).status,409)
    const listed=(await(await request('/resources?q=brief&limit=1')).json());assert.equal(listed.data.length,1)
    assert.equal((await request('/workspaces','POST',{title:'Demo',components:[{instanceId:'tasks-a',widgetType:'tasks'}],context:{goal:'Show tasks',targetInstanceIds:['tasks-a']}})).status,201)
  }finally{
    if(server.listening)await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))
    assert.equal(mongoose.connection.name,database)
    await mongoose.connection.dropDatabase()
    await disconnectMongo()
  }
})
