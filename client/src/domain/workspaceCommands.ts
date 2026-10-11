export type LayoutCommand = { action: 'add' | 'remove' | 'resize'; widget: string; span: 'wide' | 'narrow' | 'full' }
const aliases: Record<string, string> = { calendar: 'calendar', tasks: 'tasks', task: 'tasks', chart: 'chart', timeline: 'timeline', notes: 'outline', outline: 'outline', resources: 'resources', meetings: 'meetings', metrics: 'metrics', summary: 'context', availability: 'availability' }
export function parseLayoutCommand(goal: string): LayoutCommand | null {
  const text = goal.trim().toLowerCase().replace(/[.!?]+$/, '')
  const match = text.match(/^(?:please\s+)?(add|show|open|include|remove|hide|delete|make|resize|expand)\s+(?:my\s+|the\s+|a\s+|an\s+)?(calendar|tasks?|chart|timeline|notes|outline|resources|meetings|metrics|summary|availability)\b(.*)$/)
  if (!match) return null
  // Calendar event creation and task deletion are domain actions, not widget removal.
  if (/\b(event|meeting|task|record)\b/.test(match[3])) return null
  const action = ['remove', 'hide', 'delete'].includes(match[1]) ? 'remove' : ['make', 'resize', 'expand'].includes(match[1]) ? 'resize' : 'add'
  const span = /\bnarrow\b/.test(match[3]) ? 'narrow' : /\bwide\b/.test(match[3]) && !/full/.test(match[3]) ? 'wide' : 'full'
  return { action, widget: aliases[match[2]], span }
}
export function modifyWidgets<T extends { type: string; span: string }>(widgets: T[], command: LayoutCommand, create: () => T, required: string[] = []): T[] {
  const found = widgets.some(w => w.type === command.widget)
  if (command.action === 'remove') {
    if (required.includes(command.widget)) throw new Error('This widget is needed for the current goal. Start a new workspace to remove it.')
    if (!found) throw new Error('That widget is not on this page.')
    if (widgets.length === 1) throw new Error('Keep at least one widget on the workspace.')
    return widgets.filter(w => w.type !== command.widget)
  }
  if (command.action === 'resize' && !found) throw new Error('Add that widget before resizing it.')
  if (found) return widgets.map(w => w.type === command.widget ? { ...w, span: command.span } : w)
  return [...widgets, create()]
}
// Change literal registered widget calls in-place, preserving the rest of the OpenUI response.
export function patchWorkspaceResponse(response: string, command: LayoutCommand) {
  const pattern = /WorkspaceWidget\(\s*"([\w-]+)"\s*,\s*"(full|wide|narrow)"\s*\)/g
  const matches = [...response.matchAll(pattern)]
  const found = matches.filter(m => m[1] === command.widget)
  if (command.action === 'remove') {
    if (!found.length) throw new Error('That widget is not on this page.')
    if (matches.length === found.length) throw new Error('Keep at least one widget on the workspace.')
    let next = response
    for (const match of [...found].reverse()) {
      let start = match.index!, end = start + match[0].length
      const after = next.slice(end).match(/^\s*,\s*/)
      if (after) end += after[0].length
      else { const before = next.slice(0, start).match(/,\s*$/); if (before) start -= before[0].length }
      next = next.slice(0, start) + next.slice(end)
    }
    return next
  }
  if (command.action === 'resize' && !found.length) throw new Error('Add that widget before resizing it.')
  if (found.length) return response.replace(pattern, (full, id: string) => id === command.widget ? `WorkspaceWidget("${id}", "${command.span}")` : full)
  const anchor = response.match(/Workspace\(\s*\[/)
  if (!anchor || anchor.index === undefined) throw new Error('This layout cannot be changed automatically. Start a new workspace goal.')
  const insertion = anchor.index + anchor[0].length
  return response.slice(0, insertion) + `WorkspaceWidget("${command.widget}", "${command.span}"), ` + response.slice(insertion)
}
export function liveCalendarGoal(goal: string) {
  const text = goal.toLowerCase()
  if (/\b(schedule|arrange|book|create|set up)\b/.test(text) && /\b(meeting|call|appointment)\b/.test(text)) return 'schedule' as const
  if (/\b(prepare|preparation|prep|brief|agenda)\b/.test(text) && /\b(meeting|call|appointment)\b/.test(text)) return 'prepare' as const
  return null
}

export function responseWidgetsForPrompt(prompt: string): string[] | undefined {
  const command = parseLayoutCommand(prompt)
  return command ? command.action === 'remove' ? [] : [command.widget] : undefined
}

export function responseForWidgets(workingLayout: string, widgets: readonly string[]): string {
  const calls = widgets.map(widget => {
    if (!/^[a-z-]+$/.test(widget)) throw new Error('Invalid response widget.')
    const span = [...workingLayout.matchAll(/WorkspaceWidget\(\s*"([a-z-]+)"\s*,\s*"(full|wide|narrow)"\s*\)/g)].find(match => match[1] === widget)?.[2] ?? 'full'
    return `WorkspaceWidget("${widget}", "${span}")`
  })
  return `root = Card([Workspace([${calls.join(', ')}])])`
}
