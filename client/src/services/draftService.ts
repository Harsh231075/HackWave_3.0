import { createCollection } from './local/collection.ts'
import { noteSchema } from '../domain/notes.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
export function createDraftService(database:BrowserDatabase){
  const notes=createCollection(database,'notes',noteSchema)
  return {
    get:(key:string)=>database.getState().drafts[key]??null,
    save(key:string,value:string):ActionResult<void>{
      if(!key||value.length>5000)return {ok:false,message:'Keep your draft under 5000 characters.'}
      const meetingId=key.startsWith('meeting-agenda:')?key.slice(15):undefined
      if(meetingId){const meetings=database.readCollection('meetings');if(meetings.status!=='found'||!Array.isArray(meetings.value)||!meetings.value.some(m=>m.id===meetingId))return {ok:false,message:'This meeting is unavailable.'}}
      let scope: { dateRange?: { from: string; to: string }; segment?: string } = {}
      if (key.startsWith('usage-investigation:')) {
        try {
          const [from, to, segment] = JSON.parse(key.slice('usage-investigation:'.length))
          const parsed = noteSchema.safeParse({ id: key, title: 'Investigation notes', kind: 'investigation', draftKey: key, pinned: false, dateRange: { from, to }, ...(segment === 'all' ? {} : { segment }) })
          if (!parsed.success) return { ok: false, message: 'This investigation scope is invalid.' }
          scope = { dateRange: parsed.data.dateRange, segment: parsed.data.segment }
        } catch { return { ok: false, message: 'This investigation scope is invalid.' } }
      }
      return database.transaction(()=>{
        const note=notes.list().find(n=>n.draftKey===key),now=new Date().toISOString()
        const result=note?notes.update(note.id,{updatedAt:now}):notes.create({title:meetingId?'Meeting agenda':'Notes',kind:meetingId?'agenda':key.startsWith('usage-investigation:')?'investigation':'general',...(meetingId?{meetingId}:{}),...scope,draftKey:key,pinned:false,createdAt:now,updatedAt:now})
        if(!result.ok)return result
        database.dispatch({type:'draft',key,value});return {ok:true,value:undefined}
      })
    },
    rename():ActionResult<void>{return {ok:false,message:'Rename the note title in Notes.'}},
    delete(key:string):ActionResult<void>{if(!Object.hasOwn(database.getState().drafts,key))return {ok:false,message:'This draft is unavailable.'};database.dispatch({type:'delete-draft',key});return {ok:true,value:undefined}},
  }
}
