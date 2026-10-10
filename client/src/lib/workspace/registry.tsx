import { Activity, BarChart3, BookOpen, CalendarDays, Clock3, FileText, LayoutGrid, ListTodo, Sparkles, Target, Users } from 'lucide-react'
import type { ComponentType } from 'react'
import type { Role } from '@/domain/types'
import { TaskList, PriorityBoard } from '@/components/tasks/TaskWidgets'
import { AvailabilityPanel, CalendarView, DailyTimeline, MeetingList } from '@/components/calendar/CalendarWidgets'
import { ContextSummary, EditableOutline, ResourceList } from '@/components/resources/PreparationWidgets'
import { Metrics, ProductivityChart, UsageExplorer } from '@/components/insights/InsightWidgets'
import { RecentActivity, RecommendationCard } from '@/components/feedback/RecommendationCard'
import type { WidgetType } from './config'

export type WidgetDefinition = { title: string; reason: string; icon: typeof ListTodo; component: ComponentType }
export const registry: Record<WidgetType, WidgetDefinition> = {
  metrics: { title: 'At a glance', reason: 'Counts come from the tasks and focus sessions in your selected context.', icon: LayoutGrid, component: Metrics },
  tasks: { title: 'Your tasks', reason: 'Open, blocked, and completed tasks share the same records across the workspace. Filter by deadline or owner to narrow your next step.', icon: ListTodo, component: TaskList },
  timeline: { title: 'Your day, thoughtfully planned', reason: 'Scheduled sessions show where your time is committed and where there is room for focus.', icon: Clock3, component: DailyTimeline },
  meetings: { title: 'Upcoming sessions', reason: 'Upcoming meetings and classes are included so preparation can happen before the session.', icon: Users, component: MeetingList },
  board: { title: 'Focus on what matters', reason: 'Outstanding tasks are grouped by explicit priority. Blocked tasks show where coordination is needed.', icon: Target, component: PriorityBoard },
  recommendation: { title: 'A little guidance', reason: 'This static recommendation uses the earliest outstanding task and checks the suggested time against your calendar.', icon: Sparkles, component: RecommendationCard },
  outline: { title: 'Your preparation draft', reason: 'An editable outline turns preparation into work you can keep. Drafts are saved separately for each context.', icon: FileText, component: EditableOutline },
  resources: { title: 'Keep your sources close', reason: 'These linked demo materials support the selected context. Open a source to inspect its actual contents.', icon: BookOpen, component: ResourceList },
  context: { title: 'The bigger picture', reason: 'Context, courses or projects, and linked resources orient the preparation workspace.', icon: Target, component: ContextSummary },
  calendar: { title: 'Your calendar', reason: 'Sessions and task deadlines use the same records as the planner and task list, making scheduling conflicts visible.', icon: CalendarDays, component: CalendarView },
  availability: { title: 'Find an open moment', reason: 'Busy slots are calculated from your sessions. A selected slot pre-fills the scheduling form.', icon: Clock3, component: AvailabilityPanel },
  chart: { title: 'A clearer view of your week', reason: 'Historical charts are labeled illustrative; time allocation is calculated from today’s actual demo sessions.', icon: BarChart3, component: ProductivityChart },
  activity: { title: 'Small steps, real progress', reason: 'Local edits appear here to make changes understandable. This is a demo activity log, not live notifications.', icon: Activity, component: RecentActivity },
  usage: { title: 'Usage, with context', reason: 'Synthetic mobile and desktop records support comparison. Release timing is evidence to investigate, not a causal conclusion.', icon: BarChart3, component: UsageExplorer },
}
export function widgetTitle(id: WidgetType, role: Role) {
  if (id === 'outline') return role === 'student' ? 'Your study outline' : role === 'teacher' ? 'Your lesson outline' : 'Your meeting agenda'
  return registry[id].title
}
