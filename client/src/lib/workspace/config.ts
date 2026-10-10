import { z } from 'zod'
import type { Role } from '@/domain/types'

export const widgetTypes = ['metrics', 'tasks', 'timeline', 'meetings', 'board', 'recommendation', 'outline', 'resources', 'context', 'calendar', 'availability', 'chart', 'activity', 'usage'] as const
export type WidgetType = typeof widgetTypes[number]
export const configSchema = z.object({
  version: z.literal(1), id: z.string(), title: z.string(), description: z.string(),
  widgets: z.array(z.object({ id: z.enum(widgetTypes), span: z.enum(['wide', 'narrow', 'full']) })).max(14),
}).superRefine((config, ctx) => {
  if (new Set(config.widgets.map(widget => widget.id)).size !== config.widgets.length) ctx.addIssue({ code: 'custom', message: 'Widget IDs must be unique.' })
})
export type WorkspaceConfig = z.infer<typeof configSchema>
function preset(id: string, title: string, description: string, entries: Array<[WidgetType, 'wide' | 'narrow' | 'full']>): WorkspaceConfig {
  return configSchema.parse({ version: 1, id, title, description, widgets: entries.map(([id, span]) => ({ id, span })) })
}
export const PRESETS = {
  overview: preset('overview', 'A little clarity for your day.', 'Your tasks, time, and next steps. All in one place.', [['metrics', 'full'], ['tasks', 'wide'], ['timeline', 'narrow'], ['meetings', 'wide'], ['recommendation', 'narrow'], ['chart', 'wide'], ['activity', 'narrow']]),
  tasks: preset('tasks', 'Make progress, one task at a time.', 'A clear view of what’s next, what’s blocked, and what’s done.', [['metrics', 'full'], ['tasks', 'wide'], ['recommendation', 'narrow'], ['board', 'full']]),
  calendar: preset('calendar', 'See the shape of your week.', 'Sessions, deadlines, and a little space between them.', [['calendar', 'wide'], ['availability', 'narrow'], ['meetings', 'full']]),
  meetings: preset('meetings', 'Make every conversation count.', 'Prepare, find a time, and keep the next steps close.', [['meetings', 'wide'], ['availability', 'narrow'], ['outline', 'wide'], ['resources', 'narrow']]),
  planner: preset('planner', 'A plan that leaves room to breathe.', 'Protect your focus and fit your priorities into today.', [['timeline', 'wide'], ['recommendation', 'narrow'], ['tasks', 'wide'], ['outline', 'narrow']]),
  priorities: preset('priorities', 'Get back to what matters.', 'Bring overdue work into focus, without losing the bigger picture.', [['metrics', 'full'], ['board', 'full'], ['tasks', 'wide'], ['recommendation', 'narrow']]),
  insights: preset('insights', 'Understand your week.', 'Transparent task and time summaries. No productivity score.', [['metrics', 'full'], ['chart', 'wide'], ['timeline', 'narrow'], ['activity', 'full']]),
  planning: preset('planning', 'Plan your day.', 'Today’s timeline takes the lead, with your priorities beside it.', [['timeline', 'wide'], ['tasks', 'narrow'], ['board', 'full'], ['recommendation', 'wide'], ['outline', 'narrow']]),
  scheduling: preset('scheduling', 'Find a time that works.', 'Your calendar and availability, together in one working canvas.', [['calendar', 'wide'], ['availability', 'narrow'], ['meetings', 'wide'], ['outline', 'narrow']]),
  recovery: preset('recovery', 'Turn overdue into a next step.', 'Focus on blockers, ownership, and a realistic recovery plan.', [['metrics', 'full'], ['board', 'full'], ['tasks', 'wide'], ['recommendation', 'narrow']]),
  preparation: preset('preparation', 'Prepare with everything in reach.', 'Bring context, source material, and your editable outline together.', [['context', 'narrow'], ['outline', 'wide'], ['resources', 'narrow'], ['tasks', 'wide'], ['timeline', 'full']]),
  usage: preset('usage', 'Investigate the usage drop.', 'Compare segments and inspect evidence before drawing conclusions.', [['usage', 'wide'], ['resources', 'narrow'], ['tasks', 'wide'], ['context', 'narrow']]),
} satisfies Record<string, WorkspaceConfig>
export type PresetId = keyof typeof PRESETS
export const VIEWS = ['overview', 'tasks', 'calendar', 'meetings', 'planner', 'priorities', 'insights', 'workspace'] as const
export type View = typeof VIEWS[number]
export function configFor(view: View, mode: string, role: Role): WorkspaceConfig {
  const config = view === 'workspace' ? PRESETS[mode as PresetId] ?? PRESETS.planning : PRESETS[view]
  if (config.id !== 'preparation') return config
  const title = role === 'student' ? 'Prepare for your statistics exam.' : role === 'teacher' ? 'Prepare tomorrow’s lesson.' : 'Prepare the Northstar meeting.'
  return { ...config, title }
}
