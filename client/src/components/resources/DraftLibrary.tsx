import { useState } from 'react'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
export function DraftLibrary() {
  const [open, setOpen] = useState(false)
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Notes library</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Notes</DialogTitle></DialogHeader><NotesPanel/></DialogContent></Dialog></>
}
