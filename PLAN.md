# Plan: Orlo intent-to-interface workspace

## Goal

Complete the PS 4 adaptive workspace: start from a generic dashboard, understand a user's goal, select relevant records and tools, and arrange working components around that goal. The next milestone is a verified three-task demonstration with clarification, follow-up adaptation, preserved edits, and evidence-backed explanations.

The immediate priority is **verifying all three goals together**, then closing the remaining continuity/accessibility gaps in one continuous demonstration. Meeting preparation and overdue review already adapt their component content as well as placement. A meeting-preparation layout must display records for the selected meeting and client; an overdue review must display outstanding overdue work. Rearranging widgets that continue to show the entire workspace does not satisfy this milestone.

This document replaces the previous static-first, role-based roadmap. Checkboxes below track the current implementation: `[x]` means completed for the stated scope; `[ ]` means remaining. Mixed items are split so completed work is not confused with the remaining gap. Proposed filenames are replaced with the modules actually implemented where appropriate. No numerical completion score should be reported without a defined evaluation rubric and recorded results.

## Remaining work at a glance

The overall PS 4 milestone is **not complete**. Completed slices are meeting preparation, scoped usage investigation and project-scoped overdue review; their checkmarks do not certify every continuity/accessibility requirement.

- [x] Move usage observations/releases into browserDatabase and provide reusable filtered retrieval and a record-derived usage explorer.
- [x] Connect usage intent to validated AI composition, goal-bound widgets/metrics, editable investigation notes, follow-ups and saved usage sessions.
- [ ] Complete stable widget identities, original pin-binding preservation and deterministic capacity handling.
- [ ] Implement validated generic generated-action dispatch and semantic checks for the general generation path.
- [x] Isolate meeting task filters from dedicated/global, usage and overdue filters; persist the active meeting selection.
- [ ] Enforce broader follow-up intent scope inheritance, including paraphrases.
- [ ] Persist/restore scoped pins, compatible component state and valid pending clarification.
- [ ] Complete retrieval/catalog bounds, stronger stale-content handling and restoration of composition continuity.
- [ ] Commit a reproducible browser/evaluation harness and finish the three-task negative-case, keyboard/focus and accessibility evaluation.

Unchecked items mean either **not implemented** or **not fully verified**; the detailed entries state which. Passing the current automated suite does not turn these items into completed work. Authentication, cloud storage and real integrations are separately **deferred**, rather than unfinished prerequisites for this milestone.

## Current baseline

The following foundations exist in the codebase; this inventory does not certify every behavior in a live demonstration.

| Existing area | Main files | Current status / remaining gap |
| --- | --- | --- |
| Shared shell, sidebar, optional page actions | `client/src/App.tsx`, `components/shell/WorkspaceLayout.tsx` | Completed; preserve minimal design |
| Structured intent and clarification | `domain/intent.ts`, `services/intentService.ts`, `hooks/useAdaptiveWorkspace.ts` | Completed contract and continuation; broader follow-up semantics remain |
| Model endpoints and provider transport | `server/adaptive.ts`, `server/modelProvider.ts`, `server/chat.ts` | Intent and scoped composition implemented; provider quota errors handled |
| Registered OpenUI components | `lib/workspace/OpenUIWorkspace.tsx`, `registry.tsx` | Meeting/usage/overdue providers bind data; explicit widget instance/binding props remain |
| Semantic composition validation | `domain/adaptiveData.ts`, `domain/overdueReview.ts`, `lib/workspace/layoutValidation.ts` | Meeting/usage/overdue evidence, scope, uniqueness and spans validated; generic action contracts remain |
| Shared domain and mutations | `domain/`, `state/WorkspaceProvider.tsx` | Shared edits, scheduling, drafts and undo implemented |
| Linked local records and retrieval | `data/adaptiveDemo.ts`, `services/adaptiveDataService.ts`, `services/overdueReviewService.ts` | Meeting/usage/overdue retrieval implemented; usage includes comparable periods and linked project work |
| Scoped widgets | `state/MeetingScope.tsx`, `state/OverdueScope.tsx`, existing widgets | Meeting/usage/overdue widgets bind to resolved scope; usage task filters are isolated |
| Saved adaptive layouts | `services/layoutService.ts` | Legacy + version-2 meeting/usage/overdue sessions restore; pins, pending clarification and broader component state are not persisted |
| Validation | `server/*.test.ts`, browser and live-provider runs | 105 tests passed; scoped usage and continuous three-goal mocked checks passed; full live/accessibility evaluation remains |


Current route contract: `/` hosts the adaptive workspace; `/landing` hosts the landing page; dedicated task, calendar, meeting, planner, and priority views remain available through the existing router. `/insights` redirects to `/`. Do not restore `/app`, query-based navigation, role packs, or a chat interface.

The command dialog remains available through Ctrl+K/Cmd+K. After a successful generation it closes, leaving the workspace visible. Keep Orlo branding, local Figtree typography, the shared white theme, and minimal page text.

Tasks have no free-text Context field. Resource context and the existing context-summary widget are separate concepts and remain supported. Introduce explicit record relationships where required rather than restoring the removed task field.

## Scope

**Required for the next milestone:** structured intent resolution, clarification continuation, linked synthetic business data, deterministic retrieval, goal-specific widget bindings, validated composition, working action dispatch, pin/draft continuity, grounded explanations, persistence migration, and the three-task evaluation.

**Deferred:** authentication, cloud databases, real CRM/email/calendar integrations, collaboration, profession-specific interfaces, a new frontend framework, and general-purpose autonomous execution. The existing local auth/sharing/integration services remain local or unavailable as documented. They must not be presented as working external integrations.

Use the installed OpenUI packages and current server/provider transport. Do not add another generation framework or duplicate the shared service layer. New modules listed below are proposed; create them only when their implementation phase begins.

## Target flow and ownership

Goal submission → resolve intent/entities/dates → clarify if needed → retrieve bounded records → propose composition → validate and enforce continuity → render bound widgets → explain selections → dispatch explicit user actions.

The model interprets the goal and proposes a composition. Application code validates references, resolves records, enforces pins, and executes allowlisted actions. Prompt instructions supplement these rules; they do not enforce them.

| Contract | Required information and rules |
| --- | --- |
| IntentResolution | Version, original goal, goal type, entity references, date range/timezone, requested constraints, and either resolved/clarification/unsupported status |
| Clarification | Request ID, focused question, candidate IDs and labels, required answer fields, and retained original intent; no domain writes |
| RecordReference | Record kind and stable ID; references must resolve in the submitted workspace snapshot |
| RetrievalResult | Selected references, relevant derived metrics, bounded source excerpts, and deterministic selection reasons |
| WorkspacePlan | Version, resolved intent, stable widget instances, bindings, spans/order, evidence references, and allowed action IDs |
| WidgetBinding | Explicit selectors or validated record IDs, date/status constraints, draft scope where relevant; omitted binding means the ordinary dedicated-view behavior |
| AdaptiveSession | Last valid plan/response, resolved intent, pins, pending clarification where restorable, and compatible component state |
| ActionRequest | Known action ID and runtime-validated arguments, dispatched through existing services; no generated executable handlers |

Keep widget **type** separate from widget **instance identity**. Use stable semantic identities to preserve state, but continue rendering tasks exactly once with the existing List/Kanban selector. Follow-ups refine the resolved intent; they must not silently discard the previous entity or date scope.

## Ordered implementation phases

Acceptance paragraphs remain the target for each phase; completed checkboxes above them certify only their stated scope.

### 1. Establish the contracts and behavioral baseline

- [x] Add shared runtime intent, linked-data, meeting-composition and overdue-composition schemas and pure validation helpers in `domain/intent.ts`, `domain/adaptiveData.ts`, and `domain/overdueReview.ts`.
- [x] Define meeting preparation, usage investigation, and overdue review as intent goal types; unsupported goals preserve the current canvas. Usage intents now use scoped retrieval and validated composition.
- [x] Specify demo reference date and IANA timezone, validate real date ranges, and resolve relative meeting dates through the intent endpoint.
- [x] Add explicit `followUpOf` metadata and enforce the bounded overdue follow-ups “Only blocked tasks” and “Show all overdue tasks” in `domain/intentContinuity.ts`.
- [ ] Enforce general partial follow-up inheritance across all goal types and paraphrases; do not rely solely on model instructions for unchanged scope.
- [x] Add focused regression cases for existing routes/services, task/calendar mutations, persistence, and transport behavior.
- [x] Define usage snapshot/composition/evidence and structured follow-up scopeChanges contracts.
- [ ] Define stable widget-instance, binding and generic generated-action contracts.

**Acceptance:** schemas reject unknown entity references, invalid ranges, unsupported widget/action IDs, and malformed status unions. A follow-up such as “only blocked items” retains the prior project selection. Existing dedicated views still behave normally.

### 2. Add linked synthetic data without changing existing task fields

- [x] Add typed clients, projects, communications, issues, meetings and explicit relationships in `data/adaptiveDemo.ts` and `domain/adaptiveData.ts`.
- [x] Reuse existing task, event and resource IDs. Validate project-task/resource links, project-client ownership, meeting-event links and communication/issue scope.
- [x] Provide two clients/projects, two tomorrow meetings, previous meetings, unrelated records and blocked work; test completed overdue tasks, missing data and conflicting links without restoring task Context.
- [x] Add narrow collection factories and candidate-catalog/meeting-preparation services through browserDatabase, reusing collection/result conventions.
- [x] Seed missing collections additively; preserve edited domain records, existing empty collections and malformed raw storage.
- [x] Add linked usage observations, record-derived segments and releases; replace the widget-local usage array with browserDatabase services.
- [x] Seed two clients with segment differences and linked releases; derive first/last-day comparisons and distinguish timing from causation.
- [x] Compare equal-length early/late periods within selected dates, exclude the odd middle day, and report missing coverage/zero baselines. Endpoint comparisons remain explicitly labeled.

**Acceptance:** every relationship resolves to a real fixture record. A Northstar selection excludes another client's records. Reload and seeding do not overwrite edited tasks/events/drafts. No task Context input or filter returns.

### 3. Implement intent resolution and clarification continuation

- [x] Extract reusable provider calls into `server/modelProvider.ts`, retaining provider selection, cancellation, errors and configurable structured-output limits.
- [x] Implement `/api/intent` in `server/adaptive.ts`: goal, catalog candidates, demo clock, timezone and prior intent produce runtime-validated structured responses.
- [x] Use separate intent and composition endpoints plus an application workflow result union; clarification/unsupported responses remain distinct from transport failures. Existing general generation remains available.
- [x] Validate request IDs, original goals, retained partial intent and clarification answers in `domain/intent.ts` and `services/intentService.ts`.
- [x] Introduce `hooks/useAdaptiveWorkspace.ts` to own the adaptive workflow outside `DynamicWorkspace.tsx`.
- [x] Render application-owned entity/date clarification controls in the command dialog. Selection continues the original goal; cancellation preserves domain records and the current canvas.
- [x] Reject stale/incompatible answers and supersede pending clarification when a new goal is submitted.
- [ ] Automatically re-resolve a removed candidate or stale question instead of requiring the user to submit the goal again.
- [ ] Bound the candidate catalog passed to intent resolution while preserving a way to select omitted candidates; the existing request byte limit does not impose entity-count limits.

**Acceptance:** “Prepare tomorrow's meeting” asks which meeting when multiple candidates match. Choosing Northstar generates Northstar's preparation view without requiring the user to retype their goal. Cancellation, invalid answers, stale replies, and unsupported requests leave the last valid canvas usable.

### 4. Retrieve relevant records deterministically

- [x] Implement goal-specific retrieval through `adaptiveDataService.loadPreparation` and `overdueReviewService.load`, reading current browserDatabase snapshots.
- [x] Meeting retrieval selects the current meeting/event, client/project, previous meeting, latest relevant communications, open issues and explicitly linked tasks/resources.
- [ ] Add a usage summary to meeting retrieval once linked usage data exists.
- [x] Implement `usageInvestigationService` retrieval by client/project, inclusive dates and segment, with chart series, endpoint comparisons, missing/zero-baseline handling and release evidence.
- [x] Add comparable-period analysis, date-scoped communications, current open project issues and explicitly linked project tasks/resources to usage retrieval. Issues have no date field and are not presented as period-specific.
- [x] Overdue retrieval selects explicit project-linked outstanding tasks before the reference date, intersecting the inclusive date range and requested priority/status constraints; conflicting assignments are excluded.
- [x] Keep owner names searchable in local task filters.
- [ ] Implement owner-ID retrieval constraints if an owner directory is introduced; `ownerId` is currently reserved, not enforced.
- [x] Produce typed evidence references and deterministic meeting/overdue selection reasons; preserve valid empty results and distinguish missing/invalid data.
- [x] Bound meeting record counts and source text sizes.
- [ ] Add explicit overdue record-count bounds.
- [x] Bound usage collections/date ranges and handle missing coverage, zero baselines and unsafe aggregate totals.
- [x] Send selected meeting/overdue snapshots to `/api/workspace/compose` and validate schemas on the server. Local browser data is demo context, not authenticated truth.
- [x] Re-read current records after generation and reject disappeared/out-of-scope references before replacing the canvas.
- [ ] Define and validate snapshot/version fingerprints for important content changes that leave IDs in scope, so generated explanations cannot retain outdated facts. Current revalidation checks membership/schema, not every source-content change.

**Acceptance:** identical intent and snapshot produce identical selected IDs. Unrelated clients' records never appear. Overdue excludes completed work. Usage comparisons disclose missing/zero baselines and do not invent percentages. Evidence links open the supporting record.

### 5. Bind reusable widgets to the resolved task

- [ ] Extend WorkspaceWidget/registry metadata with explicit stable instance identities, binding references and supported action capabilities. Current props remain widget type and span.
- [x] Add narrow meeting and overdue scope providers backed by the existing browserDatabase and cached record-store subscriptions.
- [x] Bind meeting context, selected meeting, tasks, resources, agenda, communications and issues to the selected meeting/project.
- [x] Bind overdue context, tasks, metrics, resources and recovery suggestions to the selected project.
- [x] Bind the reusable usage explorer chart, findings and source tables to retrieved observations/releases; client/project/date/segment controls use stored data.
- [x] Bind AI-generated usage layouts, comparison metrics, observation/release chart and source inspection, linked work and editable investigation notes to resolved usage intent. Scope changes use Ctrl K; the dedicated explorer retains its selectors.
- [x] Isolate overdue refinements from global task filters; filters narrow the immutable project/cutoff/intent selection.
- [x] Give meeting task refinements isolated filters; apply refinements only to retrieved meeting-linked tasks. Retain on reload/same-meeting follow-ups; reset for another meeting or after another goal.
- [x] Derive overdue counts, owner counts, estimated effort and recovery actions from the same final task selection.
- [x] Check focus availability against all local calendar events and valid unlinked meeting metadata, including records outside the visible project.
- [x] Add focused communications/issues views and inspectable evidence where existing resource views are insufficient.
- [x] Preserve a single tasks component, shared List/Kanban preference, component-owned controls, shared mutations and explicit empty states. Regenerate the OpenUI specification during build.

**Acceptance:** meeting preparation shows only linked records; overdue lists only matching open overdue tasks; generated metrics agree with displayed records. Editing/completing a bound task updates its dedicated view. List/Kanban switches show one representation. Empty selections show an explicit empty state.

### 6. Validate composition and explain adaptation

- [x] Return structured meeting/overdue compositions with allowlisted widget types, unique entries, spans/order, reasons and evidence references.
- [ ] Extend the plan with stable instance identities, explicit binding references, usage scope and allowed generated-action IDs.
- [x] Make validated meeting/overdue compositions authoritative and serialize them deterministically into OpenUI.
- [x] Reject mismatched scope, unresolved evidence, duplicate widgets/tasks, unsupported spans/types and excessive composition widget counts; retain syntax validation.
- [x] Validate usage composition ownership, records, evidence, required/unique widget types, request identity and scope; reject any supporting snapshot edit during generation.
- [ ] Apply equivalent semantic validation to general generation and generated action arguments.
- [x] Show on-demand “Why this component” explanations through existing information buttons, with inspectable meeting/overdue sources and unavailable-source feedback.
- [ ] Add a whole-layout explanation summarizing adaptation and continuity decisions.
- [x] Explain supplied meeting/overdue selections without claiming external synchronization or unsupported causality.
- [x] Derive usage endpoint explanations and missing-day coverage from stored measurements; show linked release records without claiming causation.
- [ ] Add measured comparable-period explanations and clearly labeled hypotheses to the future AI investigation composition.
- [x] Preserve the last valid canvas on generation, validation, cancellation and unsupported-result failures. If storage fails after success, keep the new canvas usable in memory and show persistence feedback.

**Acceptance:** invalid or invented references cannot reach the renderer. The view contains useful interactive components, not a generated essay. Each surfaced data group has an inspectable reason. Explanations do not claim unsupported causation or external synchronization.

### 7. Enforce continuity and working actions

- [x] Append omitted pins in application code for scoped meeting/usage/overdue compositions; label incompatible widgets as all-workspace records.
- [ ] Enforce pins consistently in general generated layouts as well.
- [ ] Preserve each pinned widget’s original binding and stable identity across entity changes; compatible pins currently adopt the new active scope.
- [ ] Enforce deterministic capacity limits when pins are appended and explain any resulting capacity decision.
- [x] Key agendas by meeting ID; preserve draft buffers and saved agendas when switching goals/meetings, and send only the matching agenda to meeting composition.
- [ ] Restrict unrelated draft exposure in the general generation path.
- [ ] Replace the generic Renderer `onAction` handler with validated generated-action dispatch. Current registered widgets perform their own service-backed actions; generic actions still open the command window.
- [x] Route task, event, draft and focus-recovery mutations through existing validation/services. Generation alone never executes a mutation.
- [x] Offer available-slot focus previews, explicit confirmation, current-record/conflict/duration revalidation, idempotent event IDs, activity and undo. Blocked tasks require editing first.
- [x] Preserve abort/request identity guards so superseded or cancelled generation cannot overwrite a newer goal/reset.

**Acceptance:** a pinned widget survives goal changes, an edited agenda survives switching away/back, and unrelated meetings have separate drafts. Completing a task and saving an agenda work from the generated layout. Invalid actions produce feedback without mutating records. Reset during generation cannot be undone by a late response.

### 8. Persist and migrate the adaptive session safely

- [x] Persist version-2 meeting/usage/overdue compositions, resolved intent, serialized response and scoped identity; overdue sessions also save cutoff and local filter refinements. Keep domain records in existing storage.
- [ ] Persist compatible component state and scoped pin bindings; pins currently remain session-only.
- [x] Read valid response-only version-1 layouts and version-2 meeting/general layouts without inventing bindings.
- [ ] Persist/restore pending clarification only when its version and candidates remain valid.
- [x] Restore previous usage composition alongside intent/request ID for usage follow-ups after reload.
- [ ] Restore previous meeting/overdue compositions in their workflow requests; these paths currently restore intent/request ID only.
- [x] Fall back to the default dashboard with a dismissible notice for invalid layouts or unavailable scoped records; preserve the original raw value during load.
- [x] Recompute current overdue records on reload, preserving valid empty reviews after completion or due-date changes.
- [x] Retain in-memory usability when storage fails; layout reset clears session state without resetting domain edits or collections.

**Acceptance:** refresh restores the resolved goal, scoped layout, pins, and saved entity-specific drafts. Existing valid saved layouts remain usable. Malformed or unavailable storage causes no crash or destructive initialization. Layout reset preserves domain edits.

### 9. Verify the three-task demonstration and update documentation

- [x] Add service/domain/transport regression tests for implemented intent, meeting/overdue retrieval, semantic composition validation, mutations, bounded continuity and layout compatibility.
- [x] Verify deterministic mocked-provider meeting and overdue browser flows separately from live-provider interpretation.
- [x] Verify desktop/narrow-mobile command, clarification, evidence, editing, List/Kanban, persistence, cancellation and stale-output behavior for the implemented flows.
- [ ] Finish the complete keyboard/focus/reduced-motion and reset-during-generation audit across all three goal types.
- [x] Preserve the current canvas while loading and announce progress/errors; focus the canvas after successful adaptation.
- [x] Update README and service documentation with current routes, supported scoped goals, demo clock, local-only data, setup and remaining limitations.
- [x] Record the existing meeting/overdue live evaluation and provider-quota limitation below without a numerical completion score.
- [x] Verify continuous mocked meeting → usage → overdue → meeting with a retained pin, saved agenda and usage segment follow-ups.
- [ ] Complete the live three-task and full keyboard/accessibility evaluation.
- [ ] Commit a reproducible browser/live-evaluation harness and results; current browser scripts are temporary verification artifacts.
- [ ] Complete a recorded negative-case matrix across all goals: paraphrases, unknown client/project, no records, changed/deleted entities, ambiguous dates, provider failure, rapid goals/reset races, unavailable storage and narrow viewports. Some individual cases pass today; the complete matrix is not verified.

## Required demonstration script

| Step | Input/action | Required visible result | Status |
| --- | --- | --- | --- |
| 1 | Open `/` | Generic dashboard with working shared data | ✅ Implemented |
| 2 | “Prepare tomorrow's meeting” | Focused clarification if multiple meetings match; dashboard retained | ✅ Meeting clarification verified |
| 3 | Select Northstar | Client/meeting overview, relevant communications/issues, linked tasks/resources, editable agenda | ✅ Scoped meeting flow verified |
| 4 | Edit and save agenda; pin a relevant widget | Saved draft and explicit pin state | ✅ Agenda save and pin controls verified; cross-goal binding preservation remains in phase 7 |
| 5 | “Investigate Northstar's product usage drop” | Real seeded usage periods/segments, supporting evidence, investigation actions; pin retained | ☑ Scoped usage workflow implemented; original pin-binding evaluation remains |
| 6 | Inspect evidence | Source record is visible; causal hypotheses are identified as hypotheses | ☑ Usage source inspection verified with mocked composition; model reasons require live evaluation |
| 7 | “Review overdue Atlas project work” | Outstanding overdue Atlas tasks, blockers/owners, scoped counts, recovery actions | ✅ Scoped overdue flow verified |
| 8 | “Only blocked items” | Atlas/date scope retained; selection narrows; task appears once | ☐ “Only blocked tasks” verified; “only blocked items” is not covered by the deterministic helper |
| 9 | Perform a task action; return to meeting preparation | Mutation visible elsewhere; saved Northstar agenda restored | ☐ Individual actions/agenda restoration verified; continuous three-goal run remains |
| 10 | Refresh; attempt invalid output or cancel a request | Session restored; failed/cancelled generation preserves valid UI | ✅ Meeting/overdue reload and failure/cancellation flows verified |

Also evaluate paraphrases, an unknown client, no matching records, a changed/deleted entity, ambiguous dates, provider failure, rapid goal changes, unavailable storage, and a narrow viewport. Record pass/fail and observed failures for each case.

## Validation commands

Run from `client/`:

- `npm test` for service/domain/transport/plan regression tests.
- `npm run build` for specification generation, TypeScript, and production build.
- `npm run lint` for code checks; distinguish existing warnings from new issues.

Run `git diff --check` from the repository root. Browser verification and one live-provider three-task run are separate requirements; passing unit tests alone does not prove intent accuracy or usability. API keys remain server-side and are never committed or placed in browser environment variables.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Model resolves the wrong client/date | Convincing but irrelevant UI | Candidate IDs, runtime checks, explicit ambiguity handling, visible resolved scope |
| Text matching substitutes for relationships | Cross-client data leakage in the demo | Typed links and deterministic selectors; unknown links remain missing |
| OpenUI syntax is valid but semantics are wrong | Duplicate/misbound or inert components | Structured authoritative plan, semantic validation, action allowlist |
| Existing filters override generated scope | Wrong counts and records | Separate binding constraints from view filters and intersect selections |
| Missing busy events in a bound calendar | Incorrect scheduling suggestions | Availability checks against all applicable busy events, not just visible ones |
| Pins and draft keys change during adaptation | Lost or misleading work | Stable identities, explicit pin binding policy, entity-scoped drafts |
| Schema changes overwrite local records | Data loss | Additive collections, explicit migrations, malformed-value preservation tests |
| Requests race with edits or resets | Stale canvas or missing references | Cancellation, request IDs, current-record revalidation |
| Broad business scope delays the demo | More features without PS 4 proof | Complete one meeting-preparation slice before usage and overdue expansion |
| Synthetic evidence overstates causality | Misleading explanation | Separate facts from hypotheses; label synthetic data and measurement coverage |
| Larger context exposes unrelated drafts | Privacy and relevance problems | Bounded retrieval and entity-specific draft selection |

## Dependencies and delivery order

No new cloud database or external integration is a prerequisite. The live evaluation requires a working configured model provider; automated tests use mocks. Confirm installed OpenUI action/schema capabilities from the package code before extending adapters.

Internal order: contracts → linked fixtures → intent/clarification → retrieval → bound widgets → validated composition/explanations → continuity/actions → persistence migration → full evaluation. Implement and verify meeting preparation end to end first, then reuse the same path for usage investigation and overdue review. Avoid merging all phases into one large change.

Relative effort: contracts/data **M**, intent/clarification **L**, retrieval/bindings **L**, composition/continuity **L**, persistence/evaluation **M–L**. These are planning sizes, not delivery dates. The complete milestone is **XL** because it changes cross-cutting contracts and needs live behavioral verification.

## Definition of done

- [x] Three distinct goal paths change layout and relevant content on the same workspace.
- [ ] Verify the continuous three-goal demonstration including pins and preserved edits.
- [x] Ambiguity is clarified and a validated answer continues the original task.
- [x] Meeting/overdue references, evidence, scope and widget selections are validated against supplied/current local records; registered widget actions use shared services.
- [x] Extend scoped validation, persistence and evidence checks to usage.
- [ ] Validate generic generated action dispatch.
- [x] Meeting preparation supports agenda/task edits; overdue review supports task edits and confirmed available-slot scheduling.
- [x] Add scoped editable/savable investigation notes and shared linked-task editing to usage investigation.
- [x] Bounded overdue follow-ups preserve entity/date scope, and meeting agendas survive goal changes.
- [ ] Preserve original pin bindings and enforce general follow-up inheritance across all three goals.
- [x] Reload restores compatible meeting/overdue layouts and saved records; failed generation preserves valid UI.
- [ ] Restore pins, pending clarification and broader compatible component state.
- [x] Dedicated task/calendar controls and shared local mutations remain supported by existing regression checks.
- [x] Automated checks and implemented meeting/overdue browser/live flows pass, as recorded below.
- [ ] Complete the full three-task desktop/mobile/keyboard demonstration and accessibility audit.
- [x] Documentation states local-only data, synthetic sources, supported goals and remaining limitations.

**Next implementation step:** verify the continuous three-task evaluation, then close original pin-binding/capacity, broader intent continuity and generic generated-action gaps. Complete remaining continuity/action/persistence gaps before declaring the full PS 4 milestone done.

## Validation evidence for the current implementation

- [x] Latest implementation validation (including scoped usage investigation): **105 tests passed**, no test failures (`npm test`).
- [x] TypeScript and production build passed (`npm run build`); the existing large-bundle warning remains.
- [x] Lint passed with **nine existing warnings**; no new lint errors.
- [x] Meeting mocked-browser flow passed: clarification continuation, linked records/evidence, agenda isolation, shared edits, List/Kanban, reload, invalid/unsupported output, cancellation, date clarification and mobile checks.
- [x] Overdue mocked-browser flow passed: project clarification/isolation, local-filter reload, one Kanban, blocked/all follow-ups, edit narrowing, available-slot scheduling, completion/reload, stale-generation rejection, project switching and mobile evidence.
- [x] Live meeting preparation passed: ambiguous tomorrow request → selected Northstar meeting → scoped composition → agenda persistence.
- [x] Live Groq overdue flow passed: Atlas → blocked-only → all overdue → reload → Launch. Requests hitting per-minute quota passed after retrying; provider rate limits remain an external limitation.
- [x] Usage cleanup browser checks passed: dependent client/project filters, segment/date intersections, derived figures/releases, reactive source edits, reload, missing/zero baselines, empty results, mobile evidence and malformed stored data.
- [x] Continuous mocked meeting → usage → overdue → meeting flow passed with a retained pinned outline and saved agenda.
- [x] Live configured Groq usage flow passed: scoped intent → validated usage composition → reload → mobile-only follow-up with client/project/date inheritance. One quota-limited intent request succeeded after the verification harness retried.
- [ ] Complete the full live three-task/accessibility evaluation.

These are the recorded results from the implementation turn, cross-checked against current code/tests and retained local validation logs. The application suite, production build and lint were rerun for scoped usage investigation. `git diff --check` passed. Browser scripts/results currently live in temporary verification files; promote a reproducible browser/evaluation harness into the repository if needed for ongoing evaluation.

## Implemented milestone: project overdue review and recovery

The overdue path now resolves a project, retrieves explicit project-linked outstanding tasks, validates AI composition against that selection, and renders one List/Kanban task component with isolated local refinements. Context, metrics and recovery actions share the final selection. Follow-ups “Only blocked tasks” and “Show all overdue tasks” retain project/date scope; project switches resolve the new client. Reload restores the scoped layout and recomputes records, including valid empty results.

Focus scheduling offers actual-duration available slots from 09:00–18:00, considering all calendar events and unlinked valid meeting metadata. The preview requires confirmation and revalidates scope/status/duration/conflicts immediately before creation. Stable event IDs prevent duplicates; activity, undo and local persistence use the existing services. Blocked work requires editing first. Task Context remains removed; owner-ID lookup remains reserved, with owner names searchable.

Next priority is the complete three-task PS 4 evaluation and the remaining continuity/action gaps. Production integrations and an owner directory are outside this milestone.

## Implemented milestone: usage data cleanup

- [x] Typed local usage/release collections with validated ownership and duplicate measurement prevention.
- [x] Additive two-client seed data, preserved edits/empty collections, and in-memory operation when storage is blocked.
- [x] Client/project/date/segment retrieval, derived chart/accessibility labels/findings/source tables, missing-day coverage and zero-baseline handling.
- [x] Full usage intent → validated composition → bound metrics/records/notes → structured scope follow-ups → saved session.

Comparisons include both explicitly labeled endpoints and equal-length early/late period averages, with coverage and zero-baseline safeguards. Generated usage layouts recompute current records on reload; edits during generation reject the result, and later source edits mark generated reasons as outdated. The full continuous three-task/accessibility evaluation remains separate.

## Implemented milestone: scoped usage investigation

- [x] Usage intent includes a validated optional segment and data-derived candidate segment/date extents.
- [x] Explicit scopeChanges preserve unchanged client/project/date/segment across usage follow-ups, including after reload.
- [x] Usage snapshot service retrieves owned observations/releases, project-linked tasks/resources, date-scoped communications and current open issues.
- [x] Server and client validate kind: usage composition; application widgets derive all displayed chart/metric figures from records.
- [x] Separate investigation drafts are keyed by client/project and saved through the existing draft service.
- [x] Version-2 usage sessions restore intent, composition and isolated task refinements; current records are recomputed, including valid empty results.
- [x] Complete snapshot comparison rejects source edits during generation. A stored content fingerprint identifies later evidence changes and replaces stale generated reasons with a current-record notice.
- [x] Mocked browser checks: client clarification, client isolation, segment follow-ups, previous-composition restoration, draft/filter reload, invalid evidence and changed-source preservation, empty-result reload and mobile rendering.
- [x] Live usage intent/composition, reload and segment follow-up passed against the configured provider.
- [ ] Commit the browser harness and complete the full live three-goal accessibility/pin evaluation.

## Implemented milestone: meeting task filter isolation

- [x] MeetingScope exposes locally filtered tasks and filter controls; global filters cannot hide linked meeting tasks.
- [x] Version-2 meeting layouts save taskFilters. Older sessions receive empty defaults on read without rewriting raw storage; explicit malformed filters are rejected.
- [x] Reload and successful same-meeting follow-ups retain filters. Another meeting, another goal followed by returning, and layout reset start fresh.
- [x] Filter updates keep the canvas and unsaved agenda mounted; shared task mutations/undo and List/Kanban remain intact.
- [x] Automated regression coverage passed, including schema compatibility, malformed storage, filter continuity, shared updates and unavailable storage.
- [x] Mocked browser verification passed: global isolation, local reset/status, reload/legacy defaults, same-meeting retention, meeting/goal switches, provider failure, completion/undo, one Kanban, agenda/node retention and mobile/keyboard interaction.
