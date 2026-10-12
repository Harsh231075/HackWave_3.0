// Additive metadata fixtures; existing tasks/events are never replaced during load.
export const ADAPTIVE_DEMO = {


  meetings: [
    { id: 'northstar-meeting', title: 'Northstar planning meeting',   date: '2026-10-13', start: '10:00', end: '11:00', participants: ['Maya', 'Alex'], agenda: 'Recap previous decisions\nResolve blockers\nPlan the next milestone', eventId: 'northstar-meeting' },
    { id: 'westbridge-meeting', title: 'Westbridge launch review',   date: '2026-10-13', start: '14:00', end: '15:00', participants: ['Jordan', 'Arjun'], agenda: 'Review launch assets\nConfirm owners\nAgree delivery dates' },
    { id: 'northstar-previous', title: 'Northstar previous meeting',   date: '2026-10-07', start: '10:00', end: '11:00', participants: ['Maya', 'Alex'], agenda: 'Alex to resolve identity-provider settings. Maya to investigate mobile usage.' },
    { id: 'westbridge-previous', title: 'Westbridge previous review',   date: '2026-10-06', start: '14:00', end: '15:00', participants: ['Jordan'], agenda: 'Finish launch assets and assign delivery owners.' },
  ],
  communications: [
    { id: 'northstar-email',   meetingId: 'northstar-meeting', date: '2026-10-12', sender: 'Alex', subject: 'Onboarding follow-up', body: 'Identity-provider configuration is still pending. Please cover this at the next meeting.' },
    { id: 'northstar-usage-email', meetingId:'northstar-meeting',   date: '2026-10-11', sender: 'Maya', subject: 'Mobile adoption', body: 'The mobile usage decline needs investigation before we recommend a response.' },
    { id: 'westbridge-email', meetingId:'westbridge-meeting',   date: '2026-10-12', sender: 'Jordan', subject: 'Launch assets', body: 'Two launch deliverables still need review and delivery dates.' },
  ],
  issues: [
    { id: 'northstar-onboarding', meetingId:'northstar-meeting',   title: 'Identity-provider settings missing', description: 'Client configuration blocks onboarding.', status: 'open', owner: 'Alex' },
    { id: 'northstar-closed',   title: 'Access restored', description: 'Previous access problem was resolved.', status: 'closed', owner: 'Maya' },
    { id: 'westbridge-assets', meetingId:'westbridge-meeting',   title: 'Launch assets overdue', description: 'Confirm remaining deliverables and owners.', status: 'open', owner: 'Jordan' },
  ],
  relationships: [
    ...['task-3','task-4','task-5'].map(targetId=>({id:'usage-'+targetId,sourceKind:'release',sourceId:'atlas-mobile-release',targetKind:'task',targetId,type:'related'})),
    {id:'usage-source',sourceKind:'release',sourceId:'atlas-mobile-release',targetKind:'resource',targetId:'usage-evidence',type:'related'},
    ...['task-3', 'task-4', 'task-5'].map(targetId => ({ id: `atlas-${targetId}`, sourceKind: 'meeting', sourceId: 'northstar-meeting', targetKind: 'task', targetId, type: 'related' })),
    ...['task-2', 'task-6'].map(targetId => ({ id: `launch-${targetId}`, sourceKind: 'meeting', sourceId: 'westbridge-meeting', targetKind: 'task', targetId, type: 'related' })),
    ...['meeting-notes', 'usage-evidence'].map(targetId => ({ id: `atlas-${targetId}`, sourceKind: 'meeting', sourceId: 'northstar-meeting', targetKind: 'resource', targetId, type: 'related' })),
    { id: 'launch-resource', sourceKind: 'meeting', sourceId: 'westbridge-meeting', targetKind: 'resource', targetId: 'project-brief', type: 'related' },
    { id: 'northstar-direct-task', sourceKind: 'meeting', sourceId: 'northstar-meeting', targetKind: 'task', targetId: 'task-3', type: 'related' },
    { id: 'northstar-history', sourceKind: 'meeting', sourceId: 'northstar-meeting', targetKind: 'meeting', targetId: 'northstar-previous', type: 'previous_meeting' },
    { id: 'westbridge-history', sourceKind: 'meeting', sourceId: 'westbridge-meeting', targetKind: 'meeting', targetId: 'westbridge-previous', type: 'previous_meeting' },
  ],
}
