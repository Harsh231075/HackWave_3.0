import { useState } from 'react'
import { NewNoteButton, NotesPanel } from '@/components/notes/NotesPanel'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
import { Input } from '@/components/ui/input'
export function NotesPage() {
  const [query, setQuery] = useState('')
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><WidgetFrame id="outline" pageActions><WidgetActions><Input aria-label="Search notes" placeholder="Search notes" className="w-40 sm:w-56" value={query} onChange={event => setQuery(event.target.value)}/><NewNoteButton/></WidgetActions><NotesPanel query={query} showCreateButton={false}/></WidgetFrame></main>
}
