import test from 'node:test'
import assert from 'node:assert/strict'
import { localSetup } from './fixtures/localSetup.ts'
import { createNoteService } from '../src/services/noteService.ts'
import { createBrowserDatabase } from '../src/services/browserDatabase.ts'
import { emptyRecords,freshLocalData } from '../src/services/localDataService.ts'
import { createEventService } from '../src/services/eventService.ts'
import { createDraftService } from '../src/services/draftService.ts'
test('shared notes validate, search, pin and persist one canonical body',()=>{
 const {database,storage}=localSetup(),notes=createNoteService(database);assert.equal(notes.create({title:'',body:''}).ok,false)
 const created=notes.create({title:'',body:'Find this phrase'});assert.ok(created.ok);assert.equal(created.value.title,'Untitled note');assert.equal(notes.list('PHRASE').length,1)
 assert.ok(notes.setPinned(created.value.id,true).ok);assert.equal(notes.list()[0].id,created.value.id)
 const reload=createNoteService(createBrowserDatabase(storage,emptyRecords(),freshLocalData()));assert.equal(reload.getById(created.value.id)?.body,'Find this phrase');assert.equal(reload.getById(created.value.id)?.pinned,true)
 const metadata=database.readCollection('notes');if(metadata.status==='found')assert.ok((metadata.value as object[]).every(n=>!('body' in n)&&!('projectId' in n)))
})
test('stale note edits/deletes are rejected; duplicate has a new stable key',()=>{
 const notes=createNoteService(localSetup().database),created=notes.create({title:'One',body:'Initial'});assert.ok(created.ok)
 const changed=notes.update(created.value.id,{title:'Renamed',body:'New'},created.value);assert.ok(changed.ok);assert.equal(changed.value.draftKey,created.value.draftKey)
 assert.equal(notes.update(created.value.id,{title:'Old',body:'Stale'},created.value).ok,false);assert.equal(notes.delete(created.value.id,created.value).ok,false)
 const copy=notes.duplicate(created.value.id);assert.ok(copy.ok);assert.equal(copy.value.body,'New');assert.notEqual(copy.value.draftKey,created.value.draftKey);assert.ok(notes.delete(changed.value.id,changed.value).ok)
})
test('meeting agendas synchronize event and notes, remain protected, and reject nonexistent meetings',()=>{
 const {database}=localSetup(),events=createEventService(database),notes=createNoteService(database),drafts=createDraftService(database)
 const event=events.create({title:'Meeting',date:'2026-10-12',start:'10:00',end:'11:00',category:'meeting',participants:[],agenda:'Agenda'});assert.ok(event.ok)
 const agenda=notes.list().find(n=>n.meetingId===event.value.id)!;assert.ok(agenda);assert.equal(notes.delete(agenda.id,agenda).ok,false)
 assert.ok(notes.update(agenda.id,{title:agenda.title,body:'From notes'},agenda).ok);assert.equal(events.getById(event.value.id)?.agenda,'From notes');assert.ok(drafts.save(agenda.draftKey,'From draft').ok);assert.equal(notes.getById(agenda.id)?.body,'From draft');assert.equal(drafts.save('meeting-agenda:missing','X').ok,false)
})
