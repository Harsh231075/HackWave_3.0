import type { Event, Resource, Task } from '@/domain/types'

export const DEMO_DATE = '2026-10-12'
export const DEMO_TIME = '09:15'
const tasks: Array<Omit<Task, 'id'>> = [
  { title: 'Finish the research proposal', description: 'Outline the research question, methodology, and five supporting sources for the group project.', owner: 'Maya', due: '2026-10-12', duration: 90, priority: 'high', status: 'pending' },
  { title: 'Submit the project wireframes', description: 'The first review was missed. Coordinate with Arjun and submit the revised flow.', owner: 'Arjun', due: '2026-10-10', duration: 45, priority: 'urgent', status: 'blocked' },
  { title: 'Prepare Northstar meeting brief', description: 'Review last meeting’s follow-ups and draft the client agenda.', owner: 'Maya', due: '2026-10-13', duration: 60, priority: 'high', status: 'pending' },
  { title: 'Resolve the onboarding blocker', description: 'Waiting on the client’s identity-provider settings before release.', owner: 'Alex', due: '2026-10-10', duration: 90, priority: 'urgent', status: 'blocked' },
  { title: 'Investigate the mobile usage drop', description: 'Compare mobile and desktop sessions and inspect release timing.', owner: 'Maya', due: '2026-10-12', duration: 60, priority: 'high', status: 'pending' },
  { title: 'Review overdue launch assets', description: 'Confirm ownership of the remaining launch deliverables.', owner: 'Jordan', due: '2026-10-11', duration: 40, priority: 'urgent', status: 'pending' },
  { title: 'Send the project status update', description: 'Compile decisions, blockers, and next steps.', owner: 'Maya', due: '2026-10-14', duration: 30, priority: 'medium', status: 'pending' },
  { title: 'Archive last week’s notes', description: 'File the accepted decisions and meeting notes.', owner: 'Maya', due: '2026-10-12', duration: 15, priority: 'low', status: 'completed' },
]
export const INITIAL_TASKS = tasks.map((task, index) => ({ ...task, id: `task-${index + 1}` }))
export const INITIAL_EVENTS: Event[] = [
  { id: 'focus', title: 'Focused work', date: DEMO_DATE, start: '09:30', end: '11:00', category: 'focus', participants: [], agenda: 'Make progress on the most important task.' },
  { id: 'check-in', title: 'Project check-in', date: DEMO_DATE, start: '11:30', end: '12:15', category: 'meeting', participants: ['Maya', 'Arjun', 'Jordan'], agenda: 'Review progress\nDiscuss open questions\nAgree on next steps' },
  { id: 'break', title: 'Lunch break', date: DEMO_DATE, start: '12:30', end: '13:15', category: 'break', participants: [], agenda: '' },
  { id: 'northstar-meeting', title: 'Northstar planning meeting', date: '2026-10-13', start: '10:00', end: '11:00', category: 'meeting', participants: ['Maya', 'Alex'], agenda: 'Recap previous decisions\nResolve blockers\nPlan the next milestone' },
]
export const RESOURCES: Resource[] = [
  { id: 'project-brief', title: 'Project brief', kind: 'Reference', context: 'Design project', body: 'Review the updated wireframes, check ownership of open items, and prepare a revised project flow for the next review.' },
  { id: 'meeting-notes', title: 'Northstar · previous meeting', kind: 'Meeting notes', context: 'Northstar', body: '7 October: Alex to resolve the identity-provider configuration. Maya to compare mobile usage before and after the October release. Both are open follow-ups.' },
  { id: 'usage-evidence', title: 'Mobile release & usage notes', kind: 'Evidence', context: 'Northstar', body: 'Synthetic records: mobile sessions fell from 620 to 420. A release occurred on 8 October. Timing is an observation, not proof of causation; investigate errors and segment mix.' },
]
export const INITIAL_DRAFTS: Record<string, string> = {
  outline: '1. Clarify the goal\n2. Review relevant information\n3. Identify blockers\n4. Agree on next steps and owners',
}
