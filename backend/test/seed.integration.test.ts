import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { buildFrontendSeed, seedFrontendDemo } from '../src/seed/frontend.ts'
import { connectLocalMongo, disconnectMongo } from '../src/database.ts'
import { mongoose, mongoModels } from '../src/models/index.ts'

test('frontend demo source maps into Mongo contracts without losing records or links',async()=>{
  const rows=await buildFrontendSeed('2026-10-12')
  const count=(entity:string)=>rows.filter(row=>row.entity===entity).length
  assert.equal(count('tasks'),12);assert.equal(count('events'),12);assert.equal(count('notes'),8)
  assert.equal(count('resources'),6);assert.equal(count('issues'),4);assert.equal(count('communications'),4)
  assert.equal(count('usage-observations'),56);assert.equal(count('usage-releases'),2);assert.equal(count('links'),24)
  assert.equal(rows.filter(row=>row.entity==='events'&&row.data.category==='meeting').length,5)
  const firstTask=rows.find(row=>row.entity==='tasks')!;assert.equal(firstTask.data.title,'Resolve launch blocker');assert.equal(firstTask.data.due,'2026-10-09')
  assert.equal(rows.filter(row=>row.entity==='links'&&row.data.relationType==='previous_meeting').length,2)
  assert.equal(rows.filter(row=>row.entity==='links'&&row.data.sourceType==='usage-releases').length,6)
  assert.ok(rows.filter(row=>row.entity==='notes'&&row.data.kind==='agenda').every(row=>String(row.data.body).includes('Review progress')))
  const repeated=await buildFrontendSeed('2026-10-12');assert.deepEqual(rows,repeated)
})
test('Mongo seed is repeatable and preserves edited/existing data',{skip:process.env.RUN_MONGO_TESTS!=='1'},async()=>{
  const database=`orlo_seed_test_${randomUUID().replaceAll('-','')}`
  await connectLocalMongo(`mongodb://127.0.0.1:27017/${database}`)
  try{
    const first=await seedFrontendDemo('2026-10-12')
    assert.equal(Object.values(first.counts).reduce((sum,item)=>sum+item.inserted,0),128)
    const task=await mongoModels.tasks.findOne().lean();assert.ok(task)
    await mongoModels.tasks.updateOne({id:task.id},{$set:{title:'Keep my edit'},$inc:{revision:1}})
    const now=new Date()
    await mongoModels.notes.create({id:'manual-note',title:'My own note',body:'Preserve this',kind:'general',pinned:false,revision:1,createdAt:now,updatedAt:now})
    const repeated=await seedFrontendDemo()
    assert.equal(repeated.referenceDate,'2026-10-12')
    assert.equal(Object.values(repeated.counts).reduce((sum,item)=>sum+item.inserted,0),0)
    assert.equal(Object.values(repeated.counts).reduce((sum,item)=>sum+item.skipped,0),128)
    assert.equal((await mongoModels.tasks.findOne({id:task.id}).lean())?.title,'Keep my edit')
    assert.equal(await mongoModels.notes.countDocuments({id:'manual-note'}),1)
    assert.equal(await mongoModels.tasks.countDocuments(),12)
    assert.equal(await mongoModels.links.countDocuments(),24)
    await assert.rejects(seedFrontendDemo('2026-10-13'),/will not be overwritten/)
  }finally{assert.equal(mongoose.connection.name,database);await mongoose.connection.dropDatabase();await disconnectMongo()}
})
