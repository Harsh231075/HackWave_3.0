import { EditableOutline } from '@/components/resources/PreparationWidgets'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
export function NotesPage() {
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><WidgetFrame id="outline" pageActions><EditableOutline /></WidgetFrame></main>
}
