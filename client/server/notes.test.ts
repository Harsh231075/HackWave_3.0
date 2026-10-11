import test from 'node:test'
import assert from 'node:assert/strict'
import { createBrowserStorage } from '../src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { createProjectDataService, emptyRecords, freshProjectData } from '../src/services/projectDataService.ts'
import { createNoteService } from '../src/services/noteService.ts'
import { createDraftService } from '../src/services/draftService.ts'
import { createEventService } from '../src/services/eventService.ts'
function setup() {
 const raw = new Map<string,string>()
 const storage = createBrowserStorage(() => ({ getItem:key=>raw.get(key)??null,setItem:(key,value)=>raw.set(key,value),removeItem:key=>raw.delete(key) }))
 const db=createBrowserDatabase(storage,emptyRecords(),freshProjectData(),true), projects=createProjectDataService(db), notes=createNoteService(db)
 return {db,projects,notes,projectId:projects.selectedId()!}
}
test('notes validate, isolate projects, search saved bodies, pin and persist without duplicating bodies',()=>{
 const {db,projects,notes,projectId}=setup()
 assert.equal(notes.create(projectId,{title:'',body:''}).ok,false)
 assert.equal(notes.create('missing',{title:'A',body:''}).ok,false)
 const created=notes.create(projectId,{title:'',body:'Find this phrase'});assert.ok(created.ok)
 assert.equal(created.value.title,'Untitled note')
 assert.equal(notes.list(projectId,'PHRASE').length,1)
 const other=projects.create('Other');assert.ok(other.ok);assert.equal(notes.list(other.value.id).length,1)
 assert.ok(notes.setPinned(created.value.id,true).ok)
 assert.equal(notes.list(projectId)[0].id,created.value.id)
 const reload=createNoteService(createBrowserDatabase(db.storage,emptyRecords(),freshProjectData(),true))
 assert.equal(reload.getById(created.value.id)?.pinned,true)
 assert.equal(reload.getById(created.value.id)?.body,'Find this phrase')
 const metadata=db.readCollection('notes');assert.equal(metadata.status,'found');if(metadata.status==='found')assert.ok((metadata.value as object[]).every(note=>!('body' in note)))
})
test('stale content cannot overwrite or delete notes; pin changes do not conflict',()=>{
 const {notes,projectId}=setup();const created=notes.create(projectId,{title:'One',body:'Initial'});assert.ok(created.ok)
 assert.ok(notes.setPinned(created.value.id,true).ok)
 const changed=notes.update(created.value.id,{title:'Renamed',body:'New'},created.value);assert.ok(changed.ok)
 assert.equal(changed.value.draftKey,created.value.draftKey)
 assert.equal(notes.update(created.value.id,{title:'Old',body:'Stale'},created.value).ok,false)
 assert.equal(notes.delete(created.value.id,created.value).ok,false)
 const copy=notes.duplicate(created.value.id);assert.ok(copy.ok);assert.equal(copy.value.pinned,false);assert.equal(copy.value.body,'New');assert.notEqual(copy.value.id,created.value.id)
 assert.ok(notes.delete(changed.value.id,changed.value).ok)
})
test('legacy metadata remains readable and linked agendas use one body and are protected',()=>{
 const {db,notes,projectId}=setup();const old=db.readCollection('notes');assert.equal(old.status,'found')
 assert.equal(notes.list(projectId)[0].pinned,false)
 assert.equal(notes.list(projectId)[0].updatedAt,undefined)
 assert.equal(notes.delete(notes.list(projectId)[0].id,notes.list(projectId)[0]).ok,false)
 const events=createEventService(db), drafts=createDraftService(db)
 const event=events.create({projectId,title:'Meeting',date:'2026-10-12',start:'10:00',end:'11:00',category:'meeting',participants:[],agenda:'Agenda'});assert.ok(event.ok)
 const agenda=notes.list(projectId).find(note=>note.meetingId===event.value.id)!;assert.ok(agenda)
 assert.equal(notes.delete(agenda.id,agenda).ok,false)
 assert.ok(notes.update(agenda.id,{title:agenda.title,body:'From notes'},agenda).ok)
 assert.equal(events.getById(event.value.id)?.agenda,'From notes')
 assert.ok(drafts.save(agenda.draftKey,'From draft').ok)
 assert.equal(notes.getById(agenda.id)?.body,'From draft')
 assert.ok(notes.getById(agenda.id)?.updatedAt)
})
