import { useState } from 'react'
import { NotesPanel } from '@/components/notes/NotesPanel'
import { browserDatabase, projectDataService } from '@/services'
import { draftProject } from '@/services/projectOwnership'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
export function DraftLibrary({ draftKey }: { draftKey: string }) {
  const [open, setOpen] = useState(false)
  const projectId = draftProject(browserDatabase, draftKey) ?? projectDataService.selectedId()
  return <><Button size="sm" variant="outline" onClick={() => setOpen(true)}>Notes library</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Project notes</DialogTitle></DialogHeader>{projectId && <NotesPanel key={projectId} projectId={projectId}/>}</DialogContent></Dialog></>
}
