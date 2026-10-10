# Plan: Orlo static foundation to adaptive workspace

## Summary and decisions

Build Orlo with React + TypeScript + Vite and one persistent workspace surface at `/app`. Complete the static frontend using deterministic fixtures and predefined configurations first. Add persisted operations and AI planning later without replacing the component library or renderer.

Generalize through shared entities and Student, Teacher, and Professional role packs. More professions can extend the same engine. The first working slice is generic dashboard → daily planning → overdue recovery, followed by scheduling and preparation examples.

This is the authoritative roadmap. `PHASE_1_IMPLEMENTATION_PLAN.md` remains a useful inventory of the original 18 components and eight views; this plan supersedes its separate-page emphasis, routing, sequencing, and machine-specific paths. Proposed modules below are future files unless explicitly marked as existing.

## Scope and baseline

**This task:** documentation and planning only; no application implementation.

**Stage 1:** responsive shell, reusable components, eight views, role examples, predefined compositions, in-memory shared state, component states, and local interactions. No AI calls, backend APIs, database, authentication, or external integrations. Do not simulate model responses from the command bar.

**Later:** persistent operations, context retrieval, validated AI planning, integrations, and deployment.

- [x] `client/package.json` defines React/React DOM, TypeScript, Vite, React plugin, Oxlint, and npm scripts.
- [x] `client/src/App.tsx` implements the initial landing page; `main.tsx` mounts it.
- [x] Local reference inspected at `open-intelligent-ui/`, commit `3b39c06`.
- [ ] Routing, styling libraries, domain widgets, and workspace state implemented.
- [ ] Backend, AI, and automated behavioral tests implemented.

Documentation does not count as implementation completion. Update checklists only after implementation and verification.

## Reference architecture and reuse

The reference is a travel-oriented chat application. Adapt its separation of component definitions, library registration, root layout, state, theme, and generated specification to a productivity canvas.

Reference paths below are relative to `open-intelligent-ui/`.

| Reference module | Observed responsibility | Orlo adaptation |
| --- | --- | --- |
| `src/lib/library.ts` | `createLibrary` registers built-ins and custom components | `client/src/lib/workspace/registry.ts` registers approved widgets; future `lib/openui/library.ts` exposes adapters |
| `src/lib/travel/components.tsx` | `defineComponent` connects schemas, descriptions, references, and React rendering | Ordinary typed productivity components first; thin schema adapters later |
| `src/lib/route/root.tsx` | `RouteCard` provides a vertical response root and provider | `lib/workspace/root.tsx` provides responsive primary/supporting/action regions |
| `src/lib/route/store.ts` | `useStateField` retains per-response travel edits | `state/WorkspaceProvider.tsx` retains global session data, context, and drafts independently of responses |
| `src/lib/response-theme.ts` and `.css` | Shared theme tokens | `styles/tokens.css` is authoritative for shell, primitives, widgets, charts, and OpenUI theme mapping |
| `src/lib/prompt-options.ts` | Selection rules and travel examples | Future `server/src/intent/prompt-options.ts` describes productivity goals, clarification, evidence, and component constraints |
| `src/generated/spec.json` and `npm run generate` | Generated component specification | Future generated spec comes from the adapter library; never maintain it manually |
| `src/app/page.tsx` | Mounts chat-oriented `AgentInterface` | `pages/AppPage.tsx` mounts the stable shell and workspace renderer |
| `src/app/api/chat/route.ts` | Request checks, model transport, cancellation, streaming, errors | Future separate server handles intent, tools, planning, and transport; Vite cannot execute Next.js API routes |

The reference does not supply business data, global workspace persistence, or productivity widgets. Do not adopt Next.js, MapLibre, travel prompts, Wikipedia routes, or OSRM. The clone is reference material, not a runtime dependency.

**Reuse rule:** implement each widget once. Supporting views, static presets, and future AI compositions use that implementation and the same handlers. OpenUI adapters wrap it later. Keep domain types and global state independent of OpenUI response state.

Verify applicable licenses and attribution before copying source. Architecture patterns and package APIs can guide the implementation without wholesale copying.

## Route contract

| Route | Composition |
| --- | --- |
| `/` | Landing page with entry into `/app` |
| `/app` | Default Overview dashboard |
| `/app?view=tasks` | Task management |
| `/app?view=calendar` | Calendar |
| `/app?view=meetings` | Meetings |
| `/app?view=planner` | Daily Planner |
| `/app?view=priorities` | Priority and recovery board |
| `/app?view=insights` | Productivity Insights |
| `/app?view=workspace` | Static preview selector first; intent-driven canvas later |
| `/dev/components` | Development-only component/state gallery |

Use React Router. Eight views share one shell, registry, and records. Do not build eight independently styled applications. Details open in accessible dialogs/drawers.

Unknown views fall back to Overview; unknown paths show a helpful not-found page. Direct navigation, refresh, and back/forward must work. Production hosting needs SPA fallback for `/app`.

AI changes the active configuration on the same `/app` surface. A query parameter is navigation state, not the source of truth for records or drafts. No route is created for each profession or prompt.

## Proposed modules

```text
client/src/
  App.tsx                         # providers and router
  routes/AppRoutes.tsx
  pages/LandingPage.tsx
  pages/AppPage.tsx                # shell + active composition
  pages/ComponentGallery.tsx       # development only
  components/
    ui/                           # shared shadcn primitives
    shell/                        # sidebar, top bar, command bar, drawer
    tasks/ calendar/ meetings/ planner/
    insights/ feedback/ resources/
  domain/                         # types and domain rules
  data/
    demo/                         # normalized fixtures and fixed clock
    repositories/                 # fixture implementation; future API adapter
    selectors/                    # views, metrics, calendar projections
  state/
    WorkspaceProvider.tsx         # Context + reducer
    actions.ts                    # typed local operations
  lib/workspace/
    types.ts                      # WorkspaceConfig contracts
    registry.ts                   # widget metadata and bindings
    root.tsx                      # approved layout regions
    WorkspaceRenderer.tsx
    presets/                      # views and goal examples
    role-packs.ts
    validate.ts
  styles/tokens.css
  index.css
  lib/openui/                     # Stage 3 adapters
  generated/spec.json            # Stage 3 generated artifact
server/src/                       # Stage 2 onward
  api/ domain/ repositories/
  intent/ tools/ workspace/        # Stage 3 onward
```

Folders represent responsibilities. Create modules when needed, not empty scaffolding. Smaller responsibilities can share a file until separation helps.

## Domain, configuration, and state contracts

### Shared records

Use stable IDs and links for Person, Context (course/project/client), Goal, Task, Event, TimeBlock, Resource, Draft, Recommendation, and Activity. Lesson, exam, and meeting details specialize shared concepts through typed records.

- Tasks link to owners, contexts, resources, and dependencies.
- Events represent meetings/classes/exams; meeting views select applicable records.
- Time blocks link to tasks/events; avoid counting one event twice in availability.
- Drafts are keyed by context and purpose, not widget mount order.
- Explanations and recommendations reference supporting record IDs.
- Product-usage fixtures are separate analytics records. Task completion is not product usage or proof of learning.
- A fixed demo clock and explicit timezone drive today, overdue status, and availability.

Derive metrics and calendar projections from shared state rather than separately mutable page fixtures. Include conflicts, empty results, long labels, blocked tasks, and overdue work. Role packs configure vocabulary, suggestions, example context, and presets; they do not grant authorization or erase another context's data.

### WorkspaceConfig and registry

Use one declarative, versioned application-owned contract:

| Configuration field | Purpose |
| --- | --- |
| Schema version and configuration ID | Compatibility and identifiable presets/plans |
| Goal and selected context | What this composition supports |
| Layout kind | Approved overview/planning/analysis/work-queue pattern |
| Stable widget instance ID and component type | Identity and allowlisted renderer |
| Data references and filters | Application-owned selectors resolve records |
| Region, order, permitted size | Constrained responsive placement |
| Explanation references | Record-grounded relevance |
| Allowed action IDs | Known application handlers, never generated executable code |

Registry entries define the renderer, typed options, supported sizes, data binding, actions, and accessible label. Widgets receive resolved props/callbacks; they do not import specific presets or own API retrieval.

Validate presets in Stage 1. Later model plans require runtime checks for known types, valid refs, bounded widget counts, supported options, and allowed actions. Missing data has an understandable fallback. Never accept arbitrary JSX, JavaScript, CSS, SQL, or model-defined handlers.

### State ownership

1. Domain state: tasks, events, drafts, time blocks, and activity.
2. Workspace state: current context, active config, filters, pins, previous layout.
3. Transient UI state: dialogs, hover, temporary validation.

Mount the provider above the renderer. Use record-keyed drafts and stable semantic widget IDs. Layout undo restores composition without undoing unrelated task edits; mutation undo uses separate action history. Reset Demo explicitly restores fixtures after confirmation.

Stage 1 state is in memory and resets on reload. Switching views/presets/role context must preserve edits during that session. Reload restoration belongs to Stage 2.

## Dependencies

- Existing: React/React DOM, TypeScript, Vite, React plugin, Oxlint, npm lockfile.
- Stage 1: Tailwind with supported Vite integration, shadcn/ui primitives, Lucide React, React Router, Recharts, date-fns, and Motion where purposeful.
- State starts with Context + reducer; add a store package only when complexity justifies it.
- Add runtime schema tooling when configuration validation requires it; do not install the reference's whole stack.
- Stage 3 candidates: OpenUI React Lang, Lang Core, optional React UI, CLI, and Zod. Model SDKs belong only on the server.
- Verify compatible versions and APIs when installing. The inspected reference imports `zod/v4` while declaring Zod `3.25.76`; copying version numbers is not compatibility verification.

Use Node 24 and npm. Preserve the lockfile and keep React + Vite. No model credentials in `VITE_*` variables or browser code. Server/framework/database choices are made in Stage 2, not imposed by the travel sample.

## Ordered stages and implementation checklist

### Stage 0 — Baseline and roadmap

- [x] Inspect the client and reference architecture.
- [x] Record `/app`, reuse, data/state contracts, and staged criteria.
- [x] Update README with truthful implementation status.

**Acceptance:** a developer can identify the first implementation slice and the future dynamic composition boundary.

### Stage 1 — Complete static frontend

#### 1.1 Design system, routing, and shell

- [ ] Establish tokens, typography, light/dark themes, focus styling, and restrained accent color.
- [ ] Configure shared Button/Input/Select/Tabs/Badge/Dialog/Drawer/Tooltip/Skeleton primitives.
- [ ] Implement routes, supporting view queries, fallbacks, and the development gallery.
- [ ] Build sidebar, top bar, mobile drawer, context selector, and toolbar.
- [ ] Add the labeled AI placeholder; suggestion chips populate input only.

**Acceptance:** direct `/app` navigation and history work; shell/dialog controls are keyboard usable; no prompt produces fake AI output.

#### 1.2 Fixtures and shared session state

- [ ] Define domain types, linked fixtures, demo clock, and timezone.
- [ ] Add the repository boundary, derived selectors, and Context/reducer provider.
- [ ] Implement local task updates, event creation, draft edits, filters, and reset.
- [ ] Derive metrics, calendars, and availability from the same records.

**Acceptance:** a task edit agrees across views; a meeting appears consistently in calendar/planner/meetings; conflicts produce deterministic feedback.

#### 1.3 Renderer and first working slice

- [ ] Define WorkspaceConfig, registry, layout root, and preset validation.
- [ ] Build metric/task/timeline/filter/toolbar widgets and WorkspaceRenderer first.
- [ ] Compose Overview and Daily Planning from those widgets.
- [ ] Add PriorityBoard, recommendations, confirmation, and explanations for recovery.
- [ ] Implement pins, layout undo, and state-preserving preset switches.

**Acceptance:** generic dashboard → planning → recovery changes hierarchy on `/app`; task edits and drafts survive a switch back. Visible actions work locally or explicitly show unavailable status.

#### 1.4 Finish reusable component coverage

Include populated, loading, empty, error, selected, disabled, and success states where applicable. Interactive primitives require hover/focus states. The gallery makes variants inspectable; do not invent irrelevant states for every icon.

| Done | Component | Minimum evidence |
| --- | --- | --- |
| [ ] | MetricCard | Derived value, labeled trend, description, skeleton |
| [ ] | TaskCard | Completion, priority, due date, duration, status, details/actions |
| [ ] | TaskList | Search/filter/sort, shared edits, no-results state |
| [ ] | PriorityBoard | Groups/counts and accessible priority change |
| [ ] | TaskForm | Local create/edit, required-field and duration validation |
| [ ] | CalendarView | Month/week/day, navigation, details, overlaps, mobile agenda |
| [ ] | MeetingCard | Participants, agenda, status, details; external join unavailable |
| [ ] | MeetingForm | Local scheduling, valid time range, participants |
| [ ] | AvailabilityPanel | Available/busy/selected slots and conflict feedback |
| [ ] | DailyTimeline | Events/tasks/breaks/gaps and labeled demo current time |
| [ ] | TimeBlockCard | Related records, time range, category/status |
| [ ] | RecommendationCard | Static evidence/reason, local accept/dismiss where supported |
| [ ] | ConfirmationDialog | Before/after, cancel, focus handling, actual result feedback |
| [ ] | ExplanationPanel | Goal, component selections, record-grounded reasons |
| [ ] | FilterControls | Date/status/priority/category/search/sort and reset |
| [ ] | WorkspaceToolbar | Mode, pins, layout undo, explanation toggle |
| [ ] | ProductivityChart | Variants, legends, text summary, loading/empty states |
| [ ] | WorkspaceRenderer | Bindings, approved layouts, stable IDs, missing-data fallback |
| [ ] | ResourceList | Linked materials, inspection/open action, labels |
| [ ] | EditableOutline | Shared local agenda/lesson/study draft |
| [ ] | ContextSummary | Selected course/project/client and record references |
| [ ] | EvidenceLinks | Inspectable mock evidence and safe links |

Drag-and-drop is optional; keyboard-accessible priority changes are required. Reuse shadcn primitives rather than build a competing primitive library.

#### 1.5 Assemble views and role examples

- [ ] Overview: metrics, tasks, meetings, timeline, recommendations, chart, activity.
- [ ] My Tasks: list, filters, creation/editing, details, overdue work.
- [ ] Calendar: month/week/day, deadlines, meetings, event details.
- [ ] Meetings: list, scheduling form, availability, agenda/details.
- [ ] Daily Planner: timeline, priorities, blocks, gaps, recommendations.
- [ ] Priorities: board, overdue work, deadlines, blockers, recovery summary.
- [ ] Productivity Insights: transparent task/time measures and charts.
- [ ] Workspace: daily-planning, meeting-scheduling, and overdue-recovery presets.
- [ ] Student exam preview: topics, resources, revision blocks, study outline.
- [ ] Teacher lesson preview: objectives, materials, outline, preparation tasks.
- [ ] Professional meeting preview: context, communications/issues, agenda draft.
- [ ] Usage-investigation preview: separate synthetic usage data and evidence timeline.

Role previews are configurations, not new page implementations. Label the selector as a static demo/development tool. A mock clarification selector can demonstrate design for multiple meetings, but must not claim live intent detection.

**Acceptance:** all eight views are complete and reuse records/widgets. Presets change selection and prominence, not just colors. No view consists of empty placeholder boxes.

#### 1.6 Verification and exit

- [ ] Inspect 375px, 768px, and 1440px layouts in both themes.
- [ ] Verify keyboard paths, focus restoration, contrast, labels, chart text summaries, reduced motion, and overflow.
- [ ] Exercise create/edit/complete/filter/schedule/draft/pin/undo/reset across views.
- [ ] Test critical behavior: cross-view consistency, config-switch draft preservation, invalid config fallback, scheduling conflicts.
- [ ] Run `npm run build` and `npm run lint`; document unresolved failures.
- [ ] Verify no model/backend/integration calls or credentials were introduced.

**Exit:** complete session-only static prototype. This is not yet final PS 4 AI compliance.

### Stage 2 — Persistent productivity operations

- [ ] Select server framework/database from data access and hosting needs; record the decision.
- [ ] Define versioned API contracts; replace fixture repository with API adapter.
- [ ] Persist tasks/events/resources/drafts and workspace preferences.
- [ ] Validate writes; handle loading/errors/retries/stale updates/timezones/conflicts.
- [ ] Add authentication and ownership checks before real/shared data.
- [ ] Restore context, pins, drafts, and layouts after reload.
- [ ] Test server rules, ownership isolation, and frontend consistency.

**Exit:** verified persistent operations with the same widgets and `/app`; failures remain understandable and another user's records cannot be accessed.

### Stage 3 — Intent and adaptive composition

- [ ] Run a bounded OpenUI/Vite spike with one existing widget and custom root; check callbacks, theme, and state continuity.
- [ ] Resolve intent, entities, and dates; return focused clarification for ambiguity.
- [ ] Implement deterministic tools for task/event/resource/context/usage retrieval.
- [ ] Produce an application-owned WorkspacePlan matching the approved config contract with evidence refs and action IDs.
- [ ] Validate before commit; merge pins and preserve drafts/filters intentionally.
- [ ] Expose existing widgets through thin `defineComponent`/`createLibrary` adapters where useful; generate the component spec.
- [ ] Keep WorkspacePlan authoritative for layout/actions; any OpenUI Lang within widgets is restricted to registered components.
- [ ] Implement server-side transport, cancellation, request limits, and errors inspired by the reference.
- [ ] Retain last valid canvas until replacement validates; ignore stale results after context changes.
- [ ] Connect command bar, clarification, explanations, and follow-ups.
- [ ] Evaluate paraphrases, ambiguity, unsupported goals, invalid output, tool errors, and rapid goal changes.

Flow: goal + current context → resolve/clarify → retrieve records → select/prioritize widgets → validate → merge user-controlled state → render on `/app` → explain.

An OpenUI API mismatch is resolved in the adapter or by retaining the config renderer; it does not require Next.js. Do not create a competing OpenUI workspace state system. Model selection is separate from mutation execution. Server-side handlers enforce ownership and validation; consequential changes receive concrete user review. Retrieved text cannot authorize operations.

**Exit:** unseen phrasing and follow-ups reorganize the same canvas, clarify actual ambiguity, preserve edits, and provide grounded explanations. Invalid model output cannot execute writes or replace the valid canvas.

### Stage 4 — Integrations and deployment

- [ ] Select calendar/document/LMS or project integrations from observed user demand.
- [ ] Implement connection scopes, sync status, conflicts, failures, and disconnect.
- [ ] Preview external changes; verify results and handle duplicate requests safely.
- [ ] Configure SPA fallback, API origin/proxy, server secrets, migrations, and deployment checks.
- [ ] Observe errors/timings without exposing private source content.
- [ ] Evaluate task success, corrections, retained work, explanation usefulness, and accessibility.
- [ ] Record the PS 4 demo and clearly document static versus live capabilities.

**Exit:** direct deployed `/app` refresh works; integration failures preserve a usable canvas; demonstrated actions have verified results.

## Final PS 4 demo checklist

- [ ] Start from the generic dashboard on `/app`.
- [ ] Prepare a client meeting: context, communications, issues, editable agenda.
- [ ] Investigate usage decline: usage series, segments, relevant event evidence.
- [ ] Review overdue project work: owners, blockers, priorities, recovery actions.
- [ ] Perform one meaningful action in each composition.
- [ ] Narrow context in a follow-up while retaining a pinned widget.
- [ ] Return to the earlier goal with its edited draft intact.
- [ ] Clarify ambiguous entities/dates instead of silently choosing.
- [ ] Explain selections with records; distinguish observed trends from causal hypotheses.
- [ ] Show student/teacher reuse of the same engine.

Business fixtures retain the supplied PS 4 demo; role previews show generality. Real AI claims begin only after Stage 3.

## Risks and open decisions

| Risk/decision | Impact | Mitigation/stage |
| --- | --- | --- |
| Broad profession scope | Shallow workflows and UI expansion | Shared engine; validate a few concrete goals first |
| Eight views obscure the workspace | Conventional app with an AI field | Build `/app` composition slice first |
| Layout changes remount drafts | Lost work | Provider above renderer, record-keyed drafts, stable IDs, tests |
| Fixture clock drift | Wrong deadlines/calendars | Fixed demo clock/timezone and selectors |
| OpenUI compatibility | Integration delays | Thin adapters and bounded Stage 3 spike |
| Competing state/theme layers | Inconsistent behavior | Application state and tokens remain authoritative |
| Invalid/stale model output | Broken or wrong-context canvas | Validation, cancellation, request IDs, last-valid fallback |
| Server/database unresolved | Premature dependencies | Decide in Stage 2 from actual queries/ownership/hosting |
| Source reuse terms unclear | Attribution/license ambiguity | Inspect relevant licenses before copying |
| Static demo overstated | Misleading PS 4 evidence | Explicit labels and separate static/AI acceptance |

## Dependencies and effort

Internal order: primitives + fixtures/state → registry/widgets → complete static compositions → persisted operations → intent/tools/planning → integrations. Accessibility and consistency checks run throughout.

External dependencies: compatible frontend packages in Stage 1; server/database hosting in Stage 2; model access and OpenUI API verification in Stage 3; integration access in Stage 4. Stage 1 needs no later service credentials.

Relative effort: Stage 1 **L** for complete responsive coverage; Stage 2 **L** for persistence and ownership; Stage 3 **XL** for intent/retrieval/validated adaptation; Stage 4 **L–XL** depending on integration count. These are planning sizes, not delivery dates. Verify one complete slice before expanding the inventory.
