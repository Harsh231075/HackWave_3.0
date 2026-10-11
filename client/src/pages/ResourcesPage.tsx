import { ResourceLibrary } from '@/components/resources/ResourceWorkspace'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
export function ResourcesPage() {
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><WidgetFrame id="resources" pageActions><ResourceLibrary/></WidgetFrame></main>
}
