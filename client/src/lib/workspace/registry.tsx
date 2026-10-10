import { Communications, Issues } from '@/components/resources/MeetingPreparationWidgets'
import { Activity, BarChart3, BookOpen, CalendarDays, Clock3, FileText, LayoutGrid, ListTodo, Sparkles, Target, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import { TaskList } from '@/components/tasks/TaskWidgets'
import { AvailabilityPanel, CalendarView, DailyTimeline, MeetingList } from '@/components/calendar/CalendarWidgets'
import { ContextSummary, EditableOutline, ResourceList } from '@/components/resources/PreparationWidgets'
import { Metrics, ProductivityChart, UsageExplorer } from '@/components/insights/InsightWidgets'
import { RecentActivity, RecommendationCard } from '@/components/feedback/RecommendationCard'
import type { WidgetType } from './config'

export type WidgetDefinition = { title: string; reason: string; icon: typeof ListTodo; component: ComponentType }
export const registry: Record<WidgetType, WidgetDefinition> = {
  communications: { title: 'Communications', reason: 'Recent communications linked to the selected meeting and project.', icon: FileText, component: Communications },
  issues: { title: 'Issues', reason: 'Open issues linked to the selected meeting and project.', icon: ListTodo, component: Issues },
  metrics: { title: 'Summary', reason: 'Counts come from the tasks and focus sessions in your workspace.', icon: LayoutGrid, component: Metrics },
  tasks: { title: 'Tasks', reason: 'Open, blocked, and completed tasks share the same records across the workspace. Filter by deadline or owner to narrow your next step.', icon: ListTodo, component: TaskList },
  timeline: { title: 'Timeline', reason: 'Scheduled sessions show where your time is committed and where there is room for focus.', icon: Clock3, component: DailyTimeline },
  meetings: { title: 'Meetings', reason: 'Upcoming meetings and classes are included so preparation can happen before the session.', icon: Users, component: MeetingList },

  recommendation: { title: 'Suggestions', reason: 'This static recommendation uses the earliest outstanding task and checks the suggested time against your calendar.', icon: Sparkles, component: RecommendationCard },
  outline: { title: 'Draft', reason: 'An editable outline turns preparation into work you can keep. Drafts are saved in your shared workspace.', icon: FileText, component: EditableOutline },
  resources: { title: 'Resources', reason: 'These linked demo materials support the selected context. Open a source to inspect its actual contents.', icon: BookOpen, component: ResourceList },
  context: { title: 'Context', reason: 'Context, courses or projects, and linked resources orient the preparation workspace.', icon: Target, component: ContextSummary },
  calendar: { title: 'Calendar', reason: 'Month, week, day, and agenda views share event records and deadlines. Includes quick creation, event editing, deletion with undo, category filters, and an optional availability panel. Use this single calendar widget instead of adding duplicate meetings or availability widgets for a calendar goal.', icon: CalendarDays, component: CalendarView },
  availability: { title: 'Availability', reason: 'Busy slots are calculated from your sessions. A selected slot pre-fills the scheduling form.', icon: Clock3, component: AvailabilityPanel },
  chart: { title: 'Progress', reason: 'Historical charts are labeled illustrative; time allocation is calculated from today’s actual demo sessions.', icon: BarChart3, component: ProductivityChart },
  activity: { title: 'Activity', reason: 'Local edits appear here to make changes understandable. This is a demo activity log, not live notifications.', icon: Activity, component: RecentActivity },
  usage: { title: 'Usage', reason: 'Synthetic mobile and desktop records support comparison. Release timing is evidence to investigate, not a causal conclusion.', icon: BarChart3, component: UsageExplorer },
}
export function widgetTitle(id: WidgetType) { return registry[id].title }
