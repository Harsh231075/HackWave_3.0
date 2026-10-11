# Natural language component routing

Start from the existing dashboard, press Ctrl/Cmd+K, and describe what you need. Every prompt updates the same active workspace. Existing components remain visible when the topic changes. The Orlo header stays on top; there is no permanent bottom chat input. Open the command popup again for each prompt.

The server resolves English, Hindi and Hinglish into a validated component plan. It selects registered components and typed filters, using the current date/timezone and available record catalog. Invalid or unavailable model responses use the local parser. Ambiguous requests ask a short clarification rather than inventing scope.

| Existing component | Example |
| --- | --- |
| Summary / metrics | How many pending tasks do I have? |
| Tasks | Aaj ke pending tasks dikhao |
| Timeline | Show today's timeline |
| Meetings | Show tomorrow's meetings |
| Recommendations | Help me prioritize my tasks |
| Editable notes | Show my notes |
| Resources | Show Statistics documents |
| Project context | Show project background |
| Calendar | Show calendar this week |
| Availability | Show free slots |
| Productivity chart | Show time allocation |
| Activity | Show recent changes |
| Usage | Show usage sessions |
| Communications | Show messages |
| Issues | Show open issues |

Task selection applies status, priority, owner, due dates and sort order to the records. Open/incomplete includes blocked tasks; pending selects only pending tasks. “Only blocked” retains compatible previous filters, and “show all tasks” explicitly clears task filters without removing other components. Each component keeps its own settings, so tomorrow’s meetings do not change today’s tasks. Layout, order and component bindings survive reload. Unsaved draft buffers survive layout changes; save a draft to retain it after reload.

Workspace commands support add, remove, clear, keep-only, replace, filter/presentation changes, resizing and reorder. “Only high priority” changes a task filter; it does not remove other cards. Examples:

- “Show today’s overview” → “Add a suggestions card” → “Show my meetings”: extend the same workspace.
- “Remove all”: allow an empty workspace, including removal of the final component.
- “Remove all except meetings”: keep Meetings and its settings.
- “Remove all and show me my meetings”: clear, then add Meetings.
- “Remove everything except meetings and add my upcoming deadlines”: keep Meetings, then add/update Tasks with incomplete work due today or later.
- “Move suggestions above the overview”: reorder without remounting unrelated cards.
- “Replace tasks with calendar”: replace only the specified component.
- “Make calendar narrow”: resize Calendar.

Combined requests can select multiple components, such as “show tasks and calendar.” Meeting preparation, meeting scheduling, usage investigations and overdue project reviews retain their dedicated workflows. Calendar creation still requires the explicit confirmation step.

## Data boundaries

Local tasks, timelines, documents, messages, issues and usage continue using the existing records. Explicit project/client scopes use available links. Connected calendar and meetings use Google primary calendar events; availability uses Google free/busy. Calendar week/month options fetch the corresponding event window and display an agenda list. Google event types are not classified into local focus/class categories.

Activity records have no timestamps, so a date-specific activity request asks for clarification. Historical productivity charts retain the existing illustrative dataset and label it as such. Missing records show empty states. This work broadens intent and component coverage; it does not make demo records live integrations.

## Verification

`cd client`, use Node 22.18 or later, then run `npm test`, `npm run lint` and `npm run build`.

Intent tests cover all 15 registered components, English/Hindi/Hinglish, real filtering, follow-up scopes, validation, AI responses and fallback behavior. Browser checks use an isolated profile and mocked API responses to verify chat rendering and persistence without writing to Google Calendar.
