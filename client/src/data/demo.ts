import type { Event, Resource, Role, Task } from '@/domain/types'

export const DEMO_DATE = '2026-10-12'
export const DEMO_TIME = '09:15'
export const ROLE_INFO: Record<Role, { label: string; context: string; name: string; subtitle: string }> = {
  student: { label: 'Student', context: 'University workspace', name: 'Maya', subtitle: 'Make room for learning, and everything else.' },
  teacher: { label: 'Teacher', context: 'Teaching workspace', name: 'Maya', subtitle: 'Less time organizing. More time teaching.' },
  professional: { label: 'Professional', context: 'Work workspace', name: 'Maya', subtitle: 'Bring your work into focus.' },
}
const tasks: Array<Omit<Task, 'id'>> = [
  { role: 'student', title: 'Finish the research proposal', description: 'Outline the research question, methodology, and five supporting sources for the group project.', context: 'Research methods', owner: 'Maya', due: '2026-10-12', duration: 90, priority: 'high', status: 'pending' },
  { role: 'student', title: 'Review chapters 4–6', description: 'Practice conditional probability and note questions for the statistics study group.', context: 'Statistics', owner: 'Maya', due: '2026-10-14', duration: 60, priority: 'high', status: 'pending' },
  { role: 'student', title: 'Submit the project wireframes', description: 'The first review was missed. Coordinate with Arjun and submit the revised flow.', context: 'Design project', owner: 'Arjun', due: '2026-10-10', duration: 45, priority: 'urgent', status: 'blocked' },
  { role: 'student', title: 'Write the literature review', description: 'Summarize three papers and connect their findings to the research question.', context: 'Research methods', owner: 'Maya', due: '2026-10-11', duration: 75, priority: 'urgent', status: 'pending' },
  { role: 'student', title: 'Prepare study-group questions', description: 'Bring two worked examples and one difficult problem to the session.', context: 'Statistics', owner: 'Maya', due: '2026-10-12', duration: 30, priority: 'medium', status: 'pending' },
  { role: 'student', title: 'Organize lecture notes', description: 'File the latest notes and readings by topic.', context: 'Statistics', owner: 'Maya', due: '2026-10-16', duration: 25, priority: 'low', status: 'completed' },
  { role: 'teacher', title: 'Prepare tomorrow’s probability lesson', description: 'Write learning objectives and choose two classroom examples.', context: 'Year 10 mathematics', owner: 'Maya', due: '2026-10-13', duration: 60, priority: 'high', status: 'pending' },
  { role: 'teacher', title: 'Return feedback on problem sets', description: 'Review the remaining problem sets and flag common misconceptions.', context: 'Year 10 mathematics', owner: 'Maya', due: '2026-10-10', duration: 90, priority: 'urgent', status: 'pending' },
  { role: 'teacher', title: 'Create the revision worksheet', description: 'Include probability trees, independent events, and exit questions.', context: 'Year 10 mathematics', owner: 'Maya', due: '2026-10-14', duration: 45, priority: 'medium', status: 'pending' },
  { role: 'teacher', title: 'Confirm lab materials', description: 'Awaiting inventory confirmation from the lab coordinator.', context: 'Science club', owner: 'Jordan', due: '2026-10-11', duration: 20, priority: 'high', status: 'blocked' },
  { role: 'teacher', title: 'Upload class resources', description: 'Prepare the reading pack for Monday.', context: 'Year 10 mathematics', owner: 'Maya', due: '2026-10-12', duration: 20, priority: 'low', status: 'completed' },
  { role: 'professional', title: 'Prepare Northstar meeting brief', description: 'Review last meeting’s follow-ups and draft the client agenda.', context: 'Northstar', owner: 'Maya', due: '2026-10-13', duration: 60, priority: 'high', status: 'pending' },
  { role: 'professional', title: 'Resolve the onboarding blocker', description: 'Waiting on the client’s identity-provider settings before release.', context: 'Northstar', owner: 'Alex', due: '2026-10-10', duration: 90, priority: 'urgent', status: 'blocked' },
  { role: 'professional', title: 'Investigate the mobile usage drop', description: 'Compare mobile and desktop sessions and inspect release timing.', context: 'Northstar', owner: 'Maya', due: '2026-10-12', duration: 60, priority: 'high', status: 'pending' },
  { role: 'professional', title: 'Review overdue launch assets', description: 'Confirm ownership of the remaining launch deliverables.', context: 'Launch project', owner: 'Jordan', due: '2026-10-11', duration: 40, priority: 'urgent', status: 'pending' },
  { role: 'professional', title: 'Send the project status update', description: 'Compile decisions, blockers, and next steps.', context: 'Launch project', owner: 'Maya', due: '2026-10-14', duration: 30, priority: 'medium', status: 'pending' },
  { role: 'professional', title: 'Archive last week’s notes', description: 'File the accepted decisions and meeting notes.', context: 'Northstar', owner: 'Maya', due: '2026-10-12', duration: 15, priority: 'low', status: 'completed' },
]
export const INITIAL_TASKS = tasks.map((task, index) => ({ ...task, id: `task-${index + 1}` }))
export const INITIAL_EVENTS: Event[] = [
  ...(['student', 'teacher', 'professional'] as Role[]).flatMap(role => [
    { id: `${role}-focus`, role, title: role === 'student' ? 'Research & writing' : role === 'teacher' ? 'Lesson preparation' : 'Deep work', date: DEMO_DATE, start: '09:30', end: '11:00', category: 'focus' as const, participants: [], agenda: 'Focus on your highest-priority preparation task.' },
    { id: `${role}-meeting`, role, title: role === 'student' ? 'Statistics study group' : role === 'teacher' ? 'Department planning' : 'Team check-in', date: DEMO_DATE, start: '11:30', end: '12:15', category: 'meeting' as const, participants: ['Maya', 'Arjun', 'Jordan'], agenda: 'Review progress\nDiscuss open questions\nAgree on next steps' },
    { id: `${role}-break`, role, title: 'Lunch & a little breathing room', date: DEMO_DATE, start: '12:30', end: '13:15', category: 'break' as const, participants: [], agenda: '' },
    { id: `${role}-tomorrow`, role, title: role === 'student' ? 'Research methods seminar' : role === 'teacher' ? 'Probability: classroom session' : 'Northstar client meeting', date: '2026-10-13', start: '10:00', end: '11:00', category: role === 'professional' ? 'meeting' as const : 'class' as const, participants: ['Maya', 'Alex'], agenda: 'Recap previous session\nAddress outstanding questions\nPlan the next milestone' },
  ]),
  { id: 'statistics-exam', role: 'student', title: 'Statistics midterm', date: '2026-10-16', start: '09:00', end: '10:30', category: 'class', participants: [], agenda: 'Probability, distributions, and hypothesis testing.' },
]
export const RESOURCES: Resource[] = [
  { id: 'student-notes', role: 'student', title: 'Statistics · revision notes', kind: 'Reading', context: 'Statistics', body: 'Exam: Friday 16 October, 09:00. Topics: conditional probability, distributions, and hypothesis testing. Review chapters 4–6 and practice two worked problems per topic.' },
  { id: 'student-brief', role: 'student', title: 'Research proposal brief', kind: 'Assignment', context: 'Research methods', body: 'Your proposal needs a research question, methodology, five supporting sources, and a short limitations section. The draft is due Monday 12 October.' },
  { id: 'teacher-guide', role: 'teacher', title: 'Probability · lesson guide', kind: 'Lesson resource', context: 'Year 10 mathematics', body: 'Learning objective: use probability trees to explain independent events. Start with a coin-toss warm-up, model one example, then use paired practice and an exit question.' },
  { id: 'teacher-rubric', role: 'teacher', title: 'Problem-set feedback rubric', kind: 'Rubric', context: 'Year 10 mathematics', body: 'Check setup, mathematical reasoning, calculation accuracy, and interpretation. Give one actionable next step for each learner. Do not infer learning from time spent.' },
  { id: 'professional-notes', role: 'professional', title: 'Northstar · previous meeting', kind: 'Meeting notes', context: 'Northstar', body: '7 October: Alex to resolve the identity-provider configuration. Maya to compare mobile usage before and after the October release. Both are open follow-ups for the next meeting.' },
  { id: 'professional-release', role: 'professional', title: 'Mobile release & usage notes', kind: 'Evidence', context: 'Northstar', body: 'Synthetic demo records: mobile sessions fell from 620 to 420 over the comparison week. A release occurred on 8 October. Timing is an observation, not proof of causation; investigate errors and segment mix.' },
]
export const INITIAL_DRAFTS: Record<string, string> = {
  'student:outline': '1. Review conditional probability\n2. Practice distributions with worked examples\n3. Revisit hypothesis testing\n4. Bring open questions to the study group',
  'teacher:outline': 'Objective: explain independent events with probability trees\nWarm-up: coin-toss discussion (5 min)\nModel a worked example (10 min)\nPaired practice (20 min)\nExit question and reflection (5 min)',
  'professional:outline': '1. Review onboarding progress\n2. Resolve identity-provider blocker\n3. Discuss mobile usage findings\n4. Agree on owners and next steps',
}
