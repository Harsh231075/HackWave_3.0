import { useState } from 'react'
import { NewNoteButton, NotesPanel } from '@/components/notes/NotesPanel'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
import { Input } from '@/components/ui/input'
import { projectDataService } from '@/services'
export function NotesPage() {
  const projectId = projectDataService.selectedId()
  return projectId ? <ProjectNotes key={projectId} projectId={projectId}/> : null
}
function ProjectNotes({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState('')
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><WidgetFrame id="outline" pageActions><WidgetActions><Input aria-label="Search notes" placeholder="Search notes" className="w-40 sm:w-56" value={query} onChange={event => setQuery(event.target.value)}/><NewNoteButton projectId={projectId}/></WidgetActions><NotesPanel projectId={projectId} query={query} showCreateButton={false}/></WidgetFrame></main>
}
