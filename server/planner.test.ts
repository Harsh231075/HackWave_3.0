import test from 'node:test'
import assert from 'node:assert/strict'
import { plannerSummary, slotConflicts } from '../client/src/domain/plannerTime.ts'
import { createPlannerSchedulingService } from '../client/src/services/plannerSchedulingService.ts'
import { createBrowserDatabase } from '../client/src/services/browserDatabase.ts'
import { createBrowserStorage } from '../client/src/services/local/browserStorage.ts'
import { addDemoPreview } from './fixtures/demoPreview.ts'
import type { CalendarEvent, CalendarConnection } from '../client/src/domain/calendar.ts'
import type { Event, Task } from '../client/src/domain/types.ts'
const date='2100-01-02',zone='UTC'
const task:Task={id:'task',title:'Work',description:'Do it',owner:'Alex',due:date,duration:60,priority:'high',status:'pending'}
const event:CalendarEvent={id:'google-a',calendarId:'primary',title:'Meeting',description:'',start:date+'T10:00:00Z',end:date+'T11:00:00Z',allDay:false,timezone:zone,attendees:[],organizer:'',location:'',meetingUrl:'',url:'',revision:'1',status:'confirmed'}
function local(start:string,end:string,category:Event['category']='meeting'):Event{return {id:start+end,title:'Local',date,start,end,category,participants:[],agenda:''}}
function setup(){const saved=new Map<string,string>();const db=createBrowserDatabase(createBrowserStorage(()=>({getItem:key=>saved.get(key)??null,setItem:(key,value)=>{saved.set(key,value)},removeItem:key=>{saved.delete(key)}})),{tasks:[task],events:[],drafts:{},dismissed:[],activity:[]});return db}
test('open time counts union of commitments clipped to workday, including breaks',()=>{
 const summary=plannerSummary([local('08:00','10:00'),local('10:30','12:00'),local('12:00','12:30','break'),local('17:00','20:00','focus')],[event],date,zone)
 assert.equal(summary.meetingMinutes,180);assert.equal(summary.focusMinutes,60);assert.equal(summary.freeMinutes,270)
})
test('all-day and spanning Google events block the correct timezone date, transparent events stay free',()=>{
 assert.equal(plannerSummary([], [{...event,allDay:true,start:date,end:'2100-01-03'}],date,zone).freeMinutes,0)
 assert.equal(plannerSummary([], [{...event,transparent:true}],date,zone).freeMinutes,540)
 assert.equal(slotConflicts([event],date,'11:00','12:00',zone),false)
 assert.equal(slotConflicts([event],date,'15:30','16:30','Asia/Kolkata'),true)
})
test('focus confirmation rejects a newly busy Google slot and never creates a local block',async()=>{
 const db=setup(),service=createPlannerSchedulingService(db,async()=>({accountId:'a',events:[event]}),()=>({connected:true,configured:true,accountId:'a'}))
 await assert.rejects(service.schedule(task,date,{start:'10:00',end:'11:00'},zone),/occupied in Google/)
 assert.equal(db.getState().events.length,0)
})
test('provider failure and switched account fail closed',async()=>{
 const db=setup();let connection:CalendarConnection={connected:true,configured:true,accountId:'a'}
 let service=createPlannerSchedulingService(db,async()=>{throw new Error('Unavailable')},()=>connection)
 await assert.rejects(service.schedule(task,date,{start:'09:00',end:'10:00'},zone),/Unavailable/)
 service=createPlannerSchedulingService(db,async()=>{connection={...connection,accountId:'b'};return {accountId:'a',events:[]}},()=>connection)
 await assert.rejects(service.schedule(task,date,{start:'09:00',end:'10:00'},zone),/account changed/)
 assert.equal(db.getState().events.length,0)
})
test('task edits or closed planning view during verification cannot create a block',async()=>{
 const db=setup(),connection={connected:true,configured:true,accountId:'a'}
 const service=createPlannerSchedulingService(db,async()=>{db.dispatch({type:'task',task:{...task,duration:30}});return {accountId:'a',events:[]}},()=>connection)
 await assert.rejects(service.schedule(task,date,{start:'09:00',end:'10:00'},zone),/task changed/)
 const other=createPlannerSchedulingService(db,async()=>({accountId:'a',events:[]}),()=>connection)
 await assert.rejects(other.verify({...local('09:00','10:00')},zone,()=>false),/view changed/)
 assert.equal(db.getState().events.length,0)
})
test('local conflicts are rechecked after Google read; valid save uses stable task identity',async()=>{
 const db=setup();const service=createPlannerSchedulingService(db,async()=>({accountId:'a',events:[]}),()=>({connected:true,configured:true,accountId:'a'}))
 const saved=await service.schedule(task,date,{start:'09:00',end:'10:00'},zone)
 assert.equal(saved.id,`planner-focus:${task.id}:${date}`)
 await assert.rejects(service.schedule(task,date,{start:'11:00',end:'12:00'},zone),/already has/)
 assert.equal(db.getState().events.length,1)
 const other=setup(),raced=createPlannerSchedulingService(other,async()=>{other.dispatch({type:'event',event:local('09:00','10:00')});return {accountId:'a',events:[]}},()=>({connected:true,configured:true,accountId:'a'}))
 await assert.rejects(raced.schedule(task,date,{start:'09:00',end:'10:00'},zone),/local slot is no longer/)
 assert.equal(other.getState().events.length,1)
})
test('demo seeding contains no fabricated meeting links and preserves existing edits',()=>{
 const db=setup();addDemoPreview(db,date)
 assert.ok(db.getState().events.filter(e=>e.id.startsWith('demo-preview')).every(e=>!e.agenda.includes('meet.google.com')))
 const saved=db.getState().tasks.find(t=>t.id==='demo-preview-task-1')!;db.dispatch({type:'task',task:{...saved,title:'Edited sample'}})
 addDemoPreview(db,'2100-01-03');assert.equal(db.getState().tasks.find(t=>t.id===saved.id)?.title,'Edited sample')
})
