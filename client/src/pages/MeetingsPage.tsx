import { MeetingsHub } from '@/components/calendar/MeetingsHub'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
export function MeetingsPage() {
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><WidgetFrame id="meetings" pageActions><MeetingsHub/></WidgetFrame></main>
}
