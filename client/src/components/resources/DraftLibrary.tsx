import { useState } from 'react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { draftService } from '@/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DraftEditor } from './DraftEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
export function DraftLibrary({draftKey}:{draftKey:string}) {
 const {state,notify,editDraft}=useWorkspace()
 const [open,setOpen]=useState(false),[selected,setSelected]=useState(''),[name,setName]=useState(''),[remove,setRemove]=useState('')
 const keys=Object.keys(state.drafts).filter(key=>key==='outline'||key.startsWith('note:'))
 function saveNew(value:string) {
   if(!name.trim())return
   const key='note:'+name.trim()
   if(Object.hasOwn(state.drafts,key)){notify('A note with that name already exists.');return}
   const result=draftService.save(key,value)
   if(!result.ok){notify(result.message);return}
   setSelected(key);setName('')
 }
 function exportNote(){
   const url=URL.createObjectURL(new Blob([state.drafts[selected]??''],{type:'text/markdown'}))
   const a=document.createElement('a');a.href=url;a.download=selected.replace(/^note:/,'')+'.md';a.click()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 function deleteNote(){
   const result=draftService.delete(remove)
   notify(result.ok?'Note deleted. Undo record change can restore it.':result.message)
   if(result.ok){setSelected('');setRemove('')}
 }
 return <><div className="mb-3"><Button size="sm" variant="outline" onClick={()=>setOpen(true)}>Notes library</Button></div>
 <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>Notes library</DialogTitle><DialogDescription>Local notes; meeting and account-bound drafts stay in their original views.</DialogDescription></DialogHeader>
 <label className="text-sm">Note name<Input value={name} onChange={e=>setName(e.target.value)} maxLength={160}/></label>
 <div className="flex flex-wrap gap-2">{selected.startsWith('note:')&&<Button disabled={!name.trim()} variant="outline" onClick={()=>{const key='note:'+name.trim(),result=draftService.rename(selected,key);notify(result.ok?'Note renamed.':result.message);if(result.ok){setSelected(key);setName('')}}}>Rename saved note</Button>}<Button disabled={!name.trim()} onClick={()=>saveNew('')}>Create note</Button>{selected&&<Button variant="outline" disabled={!name.trim()} onClick={()=>saveNew(state.drafts[selected]??'')}>Duplicate as new note</Button>}</div>
 <select aria-label="Select note" className="rounded border p-2" value={selected} onChange={e=>{setSelected(e.target.value);setRemove('')}}><option value="">Select a note</option>{keys.map(key=><option key={key} value={key}>{key.replace(/^note:/,'')}</option>)}</select>
 {selected&&<><DraftEditor onSave={value=>draftService.save(selected,value)} key={selected} draftKey={selected} label={selected.replace(/^note:/,'')}/><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportNote}>Export saved note</Button><Button variant="outline" onClick={()=>{editDraft(draftKey,state.drafts[selected]??'');setOpen(false)}}>Copy saved text into this draft</Button><Button variant="destructive" onClick={()=>setRemove(selected)}>Delete note</Button></div></>}
 {remove&&<div className="rounded border p-3"><p>Delete saved note “{remove.replace(/^note:/,'')}”?</p><Button variant="destructive" onClick={deleteNote}>Confirm delete note</Button><Button variant="outline" onClick={()=>setRemove('')}>Keep note</Button></div>}
 </DialogContent></Dialog></>
}
