# UI Component Functionality Audit

Implementation update: see [MANUAL_COMPONENT_IMPLEMENTATION.md](MANUAL_COMPONENT_IMPLEMENTATION.md). The findings below describe the pre-implementation audit baseline.

Audit date: 11 October 2026. Scope: the current repository, including generated workspace instances, pinned instances, component controls, action handlers and data services.

## 1. Product boundary and conclusion

AI interprets a user's need and renders/manages the appropriate UI components. **The user performs record actions through buttons, inputs, forms and confirmations.** This audit does not propose prompt-driven record creation or deletion.

The product is not entirely static. Tasks, local events, drafts, local focus scheduling and Google meeting creation already have functional mutation paths. The main unfinished areas are missing controls on read-only components, services not exposed through UI, Google event update/delete, and some remaining demo/date/scope behavior.

A read-only dashboard is not automatically an unfinished feature: Summary, Context and Activity can legitimately display information. They need accurate data and appropriate navigation; they do not all need their own create/edit/delete forms.

### Evidence and verification limits

- Inspected all **15 registered widget types** and their supporting services, instance bindings and action host.
- Ran `cd client && npm test` with Node 22.18: **239 tests passed, 0 failed**.
- This is a source-and-existing-test audit. No fresh browser click-through of every form was performed in this audit. No real Google Calendar event was created, edited or deleted.
- “Working” below means an implemented control → handler → validated service/data path, supported by the existing suite; it is not a claim that every live account, browser or edge case was tested.
- Local functionality uses browser storage. A working local action is distinct from a cloud-synced or multi-user feature.

## 2. Component-by-component coverage

| Component | Working now | Static, read-only or incomplete part | UI needed to complete intended functionality | Status |
| --- | --- | --- | --- | --- |
| **Tasks** | New task in unscoped workspace; edit title, description, date, duration, priority, status and owner; complete/reopen checkbox; search, filters, sort; List/Kanban | Delete service has no task delete control. Scoped New task is disabled or rejected. Card dates and new-task defaults still use demo date. Kanban displays columns without a drag/drop handler | Reuse `TaskForm`; add task action menu + delete confirmation, scoped task/link picker; fix date defaults. Drag/drop is optional polish | Functional, incomplete CRUD |
| **Calendar — local** | Month/week/day/agenda; navigation; Today; categories; deadlines; new event from button/day/time slot; edit; delete; Undo; availability toggle | Local events are not Google events. Delete happens immediately. Calendar availability is local only | Reuse `MeetingForm` and `MeetingDetails`; add consistent delete confirmation and explicit data-source selector/label | Largely functional locally |
| **Meetings — local** | List sessions; Schedule form; detail view; edit/delete via detail view | Upcoming cutoff is `DEMO_DATE`. Meeting preparation's `SelectedMeeting` is a read-only detail view without the same management controls | Shared meeting detail/actions panel; resolve linked local event before edit; scoped relationship selector | Functional list, uneven scoped actions |
| **Meetings/Calendar — Google** | Connection, account-bound browsing, refresh, event details, external Calendar/Join links; scheduling form, availability, editable preview, explicit Confirm and create; preparation notes | Browse UI has no New meeting entry point. No in-app edit/reschedule/cancel of existing Google events. Month/week selection changes fetch range but still renders an agenda list | Expose existing `GoogleMeetingForm` from browse UI; add Google edit/reschedule form and cancel confirmation; optionally reuse a calendar grid with a Google data adapter | Real read/create; update/delete missing |
| **Timeline** | Select date; derive planned duration from local events; inspect time blocks; edit/delete through meeting details | No direct Add block control. Reads `eventService.list()` instead of scoped `state.events`. “Demo now” marker remains fixed. No Google timeline binding | Reuse `MeetingForm` for Add block; shared event actions; use scoped event source and consistent clock | Functional local view, scope/date gaps |
| **Availability** | Local busy/free detection, date selection, slot selection → prefilled local scheduling form. Google binding fetches free/busy and opens real scheduling form | Standalone slots are fixed at 60 minutes; limited work-hour choices. Google checks primary calendar, not guests' availability | Shared duration/work-hours/date controls; calendar source selector. Participant availability only if later supported by data access | Functional within current limits |
| **Suggestions** | Selects outstanding task; Schedule focus → choose slot → confirm local focus event; Dismiss. Overdue recovery includes task selector, Edit task and Schedule focus | Recommendation ranking is deterministic. Blocked tasks correctly disable scheduling. Dismiss restoration depends on record Undo, not layout Undo | Reuse `FocusScheduleDialog`; expose consistent Undo/restore dismissed suggestion. Optional ranking/preferences controls | Functional; not merely a static card |
| **Draft/Outline** | Edit/save; unsaved buffer; scoped meeting/usage/Google draft keys; save-conflict checks; local persistence | Single bound draft editor, no notes library, rename, duplicate, delete or export | Reuse `DraftEditor`; add draft list/selector + metadata/actions only if notes management is part of the feature | Working editor, limited notes management |
| **Resources** | List/filter relevant resources; open resource body/detail | Viewer only. Resource service already has create/update/delete, but this widget exposes none. File upload/download service is separate and unconnected | Resource add/edit form; resource actions + delete confirmation; project/meeting link picker; attachment picker/preview/download | Functional reader; management UI missing |
| **Context** | Displays project/client/meeting context and evidence summaries | Read-only. Generic context uses global resource counts/topics even when showing one project. No project/client management controls | Fix scoped counts first; project/client selector and details editor; linked-record picker | Read-only dashboard with scope gap |
| **Summary/Metrics** | Computes task counts, overdue count, focus duration; scoped overdue/usage summaries | No click-through to matching records. Label “today” can be inaccurate for a different selected date. Local focus totals do not include Google events | Metric drill-down links/buttons; visible date/source labels. Reuse Tasks/Timeline views | Working computed dashboard |
| **Progress/Chart** | Chart type selector; date filtering; time allocation derived from local event durations | Completion trend/comparison use a hard-coded Oct 5–11 historical array. Task edits do not generate completion-history records | Completion-history data/model first; date selector and dynamic chart adapter. Export is optional | Mixed: working allocation, illustrative history |
| **Activity** | Local changes appear in the shared activity list; latest five entries render | Entries are strings; no real timestamp, actor, entity ID or deep link. “Just now”/“Demo session” are presentation labels, not timestamp evidence. Not a notification system | Structured activity records, full history list, date/type filters, links to changed records; optional per-action undo | Functional local feed, not a complete audit log |
| **Usage** | Client/project/segment/date selection; calculated charts/comparisons; inspect measurements/releases; empty/invalid states; scoped selections | Existing local/demo records only. No UI to add/edit/delete measurements or releases, or import an external dataset | Measurement/release editor and data import/source panel; client/project selectors can be reused | Functional explorer; data entry/import missing |
| **Communications** | Scoped message list and detail reader | Read-only synthetic/local records. No add/edit/delete log entry UI, compose/send/reply, or mailbox integration | For local logs: communication form + detail actions + link selector. For actual email: separate composer, connection and transport | Functional reader; communication actions absent |
| **Issues** | Scoped list, open/closed selection through bindings, detail reader | No Create issue, Edit, Close/Reopen, Assign or Delete controls despite collection services | Issue form + issue actions/status controls + delete confirmation + owner/project/meeting picker | Functional reader; issue workflow missing |

“Overview” is a composition of existing widgets, not a separate CRUD component. Improving its task/event controls improves the overview as well.

## 3. Existing functionality to reuse

Do not build duplicate task or scheduling forms merely because the same widget appears in an AI-generated workspace.

| Existing implementation | Reuse for |
| --- | --- |
| [`TaskForm`, `TaskCard`, `TaskList`](client/src/components/tasks/TaskWidgets.tsx) | Task create/edit/complete and filtering; extend with delete and scope assignment |
| [`MeetingForm`, `MeetingDetails`](client/src/components/calendar/CalendarWidgets.tsx) | Local meeting/event/focus/class creation and management from Calendar, Meetings, Timeline and Availability |
| [`CalendarView`](client/src/components/calendar/CalendarView.tsx) | Local calendar grid, navigation, quick event creation and Undo |
| [`GoogleMeetingForm`](client/src/components/calendar/GoogleMeetingForm.tsx) | Real meeting details → availability → preview → confirmed creation |
| [`GoogleAvailabilityPanel`](client/src/components/calendar/GoogleAvailabilityPanel.tsx) | Google free-slot selection; extend options rather than recreate |
| [`FocusScheduleDialog`](client/src/components/tasks/FocusScheduleDialog.tsx) | Task-linked local focus sessions, validated slots and confirmation |
| [`DraftEditor`](client/src/components/resources/DraftEditor.tsx) | Normal, meeting, usage and Google preparation drafts |
| [`WorkspaceActionHost`](client/src/lib/workspace/WorkspaceActionHost.tsx) | Existing user-click action dispatch: task edit, draft edit, focus scheduling and goal change |
| [`InstanceCanvas`](client/src/lib/workspace/InstanceCanvas.tsx) | Instance-bound controls, per-view settings and pinned/active rendering |

The existing action host already guards original scope/revision/account and checks task changes before saving. New controls should reuse or extend that pattern. A new Delete button must delete the record selected by that instance, not guess from a title or index.

## 4. Services present but missing corresponding UI

| Data operation | Existing service | Missing user-facing connection |
| --- | --- | --- |
| Task deletion | [`taskService.delete`](client/src/services/taskService.ts) | Task action menu → confirmation → deletion → record Undo |
| Resource create/update/delete | [`resourceService`](client/src/services/resourceService.ts) | Resource form/detail actions and relationship assignment |
| Client/project management | [`adaptiveDataService`](client/src/services/adaptiveDataService.ts) | Client/project editor/selector reachable from Context |
| Issue and communication record management | [`adaptiveDataService`](client/src/services/adaptiveDataService.ts) | Forms, status/owner controls and detail actions |
| Project/meeting record linking | `relationshipService` exported from [`services/index.ts`](client/src/services/index.ts) | Link picker for tasks/resources and related meetings |
| Attachment upload/download/delete | [`fileService`](client/src/services/fileService.ts) | Attach/upload/preview/download controls; connect attachment IDs to resources. Current service is local storage, capped at 2 MB |
| Usage measurements/releases | [`usageDataService`](client/src/services/usageDataService.ts) | Data entry, edit/delete, import and source configuration |
| Notification records/settings | [`notificationService`](client/src/services/notificationService.ts) | Not evidence of scheduled reminders or delivered notifications; a reminder engine/transport would still be required |

Google writes are different: [`googleCalendarService`](client/src/services/googleCalendarService.ts) and [`calendar/handler.ts`](client/server/calendar/handler.ts) support event preview/confirmed creation, not existing-event PATCH/DELETE. Google edit/cancel needs provider/API/service work as well as new controls. An edit-looking form alone would not complete that feature.

## 5. Specific correctness gaps to verify/fix first

These findings come from current source paths; browser reproduction remains part of follow-up implementation.

1. **Demo date in task presentation/defaults.** `TaskCard` decides Today/Overdue using `DEMO_DATE`; `TaskForm` defaults to that date and owner `Maya`. The selected component has a real reference date/owner available. Make presentation and new-record defaults use the active instance while keeping explicit demo mode recognizable.
2. **Demo cutoff in local meeting list.** `MeetingList` filters upcoming sessions against `DEMO_DATE`. It can omit/show incorrect records relative to the user's current date.
3. **Timeline bypasses instance-filtered events.** `DailyTimeline` reads global `eventService.list()` but resolves selected details from `state.events`. If the view narrows events, the list and details can disagree. Verify scoped/pinned cases and use one authoritative source.
4. **Context counts are global.** The generic Context title can show a selected project while topic/resource counts still call `resourceService.list()` globally. Use the same scoped records as the Resources component.
5. **Trend history is illustrative.** `ProductivityChart` uses a hard-coded `history` array. Completing a task updates metrics, not this trend. Keep the illustrative label until durable completion history is implemented.
6. **Scoped task creation is not a completed flow.** Some New task controls are disabled; instance save guards reject scoped creation. Add an explicit project/meeting link step before making that button available.
7. **Undo visibility differs.** Workspace menu “Undo layout change” restores layout, while Calendar's record Undo restores data. Suggestions say “Undo edit” after dismissal. Expose the correct record Undo where the user performs the action; do not present layout Undo as restoring deleted records.
8. **Google calendar mode names exceed presentation coverage.** Month/week selections fetch larger windows but remain an event list. Either clearly call these date windows, or implement grid presentation.
9. **Creation reachability differs by source.** Local Calendar has New event; Google browse/detail view lacks equivalent New meeting entry. Existing scheduling UI should be reachable by a user click without another AI prompt.
10. **Pinned and scoped views need a mutation refresh check.** Multiple copies may share records but keep distinct filters, accounts and bindings. After every write, recompute affected views; never silently rebind a pinned view or update an unrelated same-title record.

## 6. Additional supporting components needed

These are **proposed components/control groups**, not files that already exist. Most belong inside current widgets, not as additional top-level cards.

| Proposed support UI | Purpose | Existing foundation | Priority |
| --- | --- | --- | --- |
| Record action menu + delete confirmation | Edit/delete/close/reopen with the exact selected record | Task/event services and existing forms | P1 |
| Record Undo/status feedback | Show success, failure and correct recovery after a mutation | `WorkspaceProvider.undo`, shared persistence result | P1 |
| Scoped record/link picker | Connect a created/selected task/resource to a project or meeting | Relationship services and binding guards | P1 |
| Meeting actions panel | Consistent local/Google details, create, edit/reschedule and cancel entry points | Local details/form; Google details and creation form | P1 |
| Resource editor + attachment controls | Add/edit/remove resources; upload/preview/download attachments | Resource/file services | P1 |
| Issue editor/status controls | Create, assign, edit, close/reopen/delete issues | Issue collection service | P1 |
| Context selector/details editor | Manage projects/clients and their linked records | Client/project/relationship services | P1 |
| Communication log editor | Add/manage local communication records | Communications collection | P2 |
| Draft library/actions | Select, name, duplicate, delete/export notes when required | Draft editor/service | P2 |
| Usage data editor/import panel | Maintain measurements/releases instead of only reading demo data | Usage data services | P2 |
| Metric drill-down controls | Open matching Tasks/Timeline without requiring another prompt | Existing component views | P2 |
| Activity history/filter panel | Inspect structured change history and linked entities | Activity feed; requires richer records | P2 |
| Shared availability options | Duration, work hours, selected date/source | Existing slot panels and scheduling forms | P2 |

Real email delivery, cloud document sync, background reminders, multi-user sharing and analytics ingestion are separate integrations. They are not prerequisites for making current local component controls functional.

## 7. Recommended completion order

### P0 — correctness and truthful data

Fix date/default handling, scoped Timeline/Context inconsistencies, confusing data-vs-layout Undo, and source labels. Keep static completion history explicitly illustrative. Preserve instance identity, record ownership and existing conflict checks.

### P1 — complete the core manual workflows

1. Finish Tasks: create/edit/complete/delete + clear recovery; make scoped creation/linking a deliberate flow.
2. Make local event management consistently reachable from Calendar, Meetings and Timeline using existing forms.
3. Expose Google meeting creation from browse UI; then implement real existing-event edit/reschedule/cancel across UI, service and provider API.
4. Add Resource and Issue management controls using existing collections.
5. Add Project/Client selection and record linking so users can maintain context instead of depending on seeded data.

### P2 — extend supporting workflows

Add communication logs, draft library, usage data entry/import, structured history, dashboard drill-downs and availability preferences. Replace illustrative trend data after completion-history records exist. Add external integrations only when the corresponding feature is in scope.

## 8. Manual acceptance checklist for follow-up implementation

Perform these in an isolated profile or test dataset. Real Google mutation checks require a designated test event/calendar; they were not performed by this audit.

| Area | Test | Expected result |
| --- | --- | --- |
| Tasks | New task → save → edit → complete/reopen → delete → Undo → reload | Correct record changes; counts/filters reflect it; persistence and recovery work |
| Scoped tasks | Create/link a task to Project A while another view shows Project B | Explicit ownership; task appears only where linked; no cross-project modification |
| Local Calendar | Create from a time slot; try conflicting times; edit/delete; Undo | Prefill correct; invalid/conflicting input rejected; Calendar/Meetings/Timeline agree |
| Meetings | Open local and preparation-bound details | Correct selected record; available actions match source and scope |
| Google browse | Refresh/date/window change; open detail; start scheduling via button | Correct account/window; creation reachable without another prompt |
| Google scheduling | Missing details → valid details → preview → confirm → retry confirmation | Validation; one event; no duplicate creation; UI refresh and error recovery |
| Google update/cancel | Edit/reschedule/cancel a designated test event | Provider data actually changes, affected UI refreshes; permission failures preserve user input |
| Timeline | Change date and scope; inspect an existing block; add/edit/delete | List and selected details use the same records; totals update |
| Availability | Change date/duration; choose a slot; make it busy before confirmation | Correct recalculation; stale selection invalidated; conflict prevented |
| Suggestions | Schedule pending task focus; try blocked task; dismiss/restore | Validated local event only after confirmation; blocked action disabled; correct Undo |
| Draft | Type without saving; reorder/pin; save/reload; simulate changed saved version | Unsaved text retained during layout changes; saved text durable; conflict shown |
| Resources | Add/edit/open/attach/download/delete a linked resource | Real stored content; valid links; no fake upload success |
| Context | Select Project A; compare counts and resources; edit/link data | Counts and details agree with the selected scope |
| Summary | Complete task/add focus event; click matching metric | Correct totals; correct date/source; matching records accessible |
| Chart | Change type/date; complete a task after real history is introduced | Allocation uses event durations; completion history reflects durable events |
| Activity | Create/edit/delete records; inspect older changes | Real timestamps/entity links when implemented; no invented “just now” labels |
| Usage | Switch client/project/date/segment; add/import measurements | Derived values match selected records; invalid/missing data distinguished from zero |
| Communications/Issues | Create/edit/link records; close/reopen issue; inspect from meeting | Lists update; ownership respected; local logs not described as delivered email |
| Multiple instances/pins | Edit through one copy while another shows the same record with different filters | Shared record updates; independent view settings preserved; stale action cannot overwrite newer data |
| Persistence/errors | Reload after saves; simulate storage/API failures | No silent success or data loss; input retained and retry/recovery available |

## 9. Completion definition

A component is functionally complete for its declared scope when all visible controls reach real handlers, reads and writes use the intended source and record identity, validation/errors/recovery work, affected views refresh, and persistence matches the UI's promise. Read-only components instead need accurate scoped data and functional inspection/navigation.

**Next implementation stage: complete manual component workflows. AI remains responsible for rendering and workspace management.**
