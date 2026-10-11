import { mailWidgetIds } from '../../domain/mail.ts'
import { extensionIds } from '../../extensions/contracts.ts'
import { z } from 'zod'

export const widgetTypes = ['metrics', 'tasks', 'timeline', 'meetings', 'recommendation', 'outline', 'resources', 'resource-create', 'context', 'calendar', 'availability', 'chart', 'activity', 'usage', 'communications', 'issues', ...extensionIds.filter((id): id is Exclude<typeof extensionIds[number], 'mail'> => id !== 'mail'), ...mailWidgetIds] as const
export type WidgetType = typeof widgetTypes[number]
export const configSchema = z.object({
  version: z.literal(1), id: z.string(), title: z.string(), description: z.string(),
  widgets: z.array(z.object({ id: z.enum(widgetTypes), span: z.enum(['wide', 'narrow', 'full']) })).max(widgetTypes.length),
}).superRefine((config, ctx) => {
  if (new Set(config.widgets.map(widget => widget.id)).size !== config.widgets.length) ctx.addIssue({ code: 'custom', message: 'Widget IDs must be unique.' })
})
export type WorkspaceConfig = z.infer<typeof configSchema>
function preset(id: string, title: string, description: string, entries: Array<[WidgetType, 'wide' | 'narrow' | 'full']>): WorkspaceConfig {
  return configSchema.parse({ version: 1, id, title, description, widgets: entries.map(([id, span]) => ({ id, span })) })
}
export const PRESETS = {
  overview: preset('overview', 'A little clarity for your day.', 'Your tasks, time, and next steps. All in one place.', [['metrics', 'full'], ['tasks', 'wide'], ['timeline', 'narrow'], ['meetings', 'wide'], ['recommendation', 'narrow'], ['chart', 'wide'], ['activity', 'narrow']]),
  tasks: preset('tasks', 'Tasks', '', [['tasks', 'full']]),
  calendar: preset('calendar', 'Calendar', '', [['calendar', 'full']]),
  meetings: preset('meetings', 'Make every conversation count.', 'Prepare, find a time, and keep the next steps close.', [['meetings', 'wide'], ['availability', 'narrow'], ['outline', 'wide'], ['resources', 'narrow']]),
  planner: preset('planner', 'A plan that leaves room to breathe.', 'Protect your focus and fit your priorities into today.', [['timeline', 'wide'], ['recommendation', 'narrow'], ['tasks', 'wide'], ['outline', 'narrow']]),
  priorities: preset('priorities', 'Get back to what matters.', 'Bring overdue work into focus, without losing the bigger picture.', [['metrics', 'full'], ['tasks', 'wide'], ['recommendation', 'narrow']]),
  home: preset('home', 'Workspace', '', [['metrics', 'full'], ['chart', 'wide'], ['timeline', 'narrow'], ['activity', 'full']]),
  planning: preset('planning', 'Plan your day.', 'Today’s timeline takes the lead, with your priorities beside it.', [['timeline', 'wide'], ['tasks', 'narrow'], ['recommendation', 'wide'], ['outline', 'narrow']]),
  scheduling: preset('scheduling', 'Scheduling', '', [['calendar', 'full'], ['outline', 'full']]),
  recovery: preset('recovery', 'Turn overdue into a next step.', 'Focus on blockers, ownership, and a realistic recovery plan.', [['metrics', 'full'], ['tasks', 'wide'], ['recommendation', 'narrow']]),
  preparation: preset('preparation', 'Prepare with everything in reach.', 'Bring context, source material, and your editable outline together.', [['context', 'narrow'], ['outline', 'wide'], ['resources', 'narrow'], ['tasks', 'wide'], ['timeline', 'full']]),
  usage: preset('usage', 'Investigate the usage drop.', 'Compare segments and inspect evidence before drawing conclusions.', [['usage', 'wide'], ['resources', 'narrow'], ['tasks', 'wide'], ['context', 'narrow']]),
} satisfies Record<string, WorkspaceConfig>
export type PresetId = keyof typeof PRESETS
export const VIEWS = ['overview', 'tasks', 'calendar', 'meetings', 'planner', 'priorities', 'workspace'] as const
export type View = typeof VIEWS[number]
export function configFor(view: View, mode: string): WorkspaceConfig {
  return view === 'workspace' ? PRESETS[mode as PresetId] ?? PRESETS.planning : PRESETS[view]
}
