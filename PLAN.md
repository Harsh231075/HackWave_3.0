# Plan: Orlo intent-to-interface workspace

## Goal

Complete the PS 4 adaptive workspace: start from a generic dashboard, understand a user's goal, select relevant records and tools, and arrange working components around that goal. The next milestone is a verified three-task demonstration with clarification, follow-up adaptation, preserved edits, and evidence-backed explanations.

The immediate priority is **adapting component content as reliably as component placement**. A meeting-preparation layout must display records for the selected meeting and client; an overdue review must display outstanding overdue work. Rearranging widgets that continue to show the entire workspace does not satisfy this milestone.

This document replaces the previous static-first, role-based roadmap. Checkboxes below describe future work, not claims of completion. No numerical completion score should be reported without a defined evaluation rubric and recorded results.

## Current baseline

The following foundations exist in the codebase; this inventory does not certify every behavior in a live demonstration.

| Existing area | Main files | Next gap |
| --- | --- | --- |
| Shared shell, sidebar, optional page actions | `client/src/App.tsx`, `components/shell/WorkspaceLayout.tsx` | Preserve the current minimal design during adaptation |
| Default canvas, command dialog, follow-up generation | `client/src/pages/DynamicWorkspace.tsx` | Add structured goal and clarification state |
| Model endpoint and provider transport | `client/server/index.ts`, `client/server/chat.ts` | Resolve intent before composing a page |
| Registered OpenUI components | `client/src/lib/workspace/OpenUIWorkspace.tsx`, `registry.tsx` | WorkspaceWidget currently accepts only widget type and span |
| Syntax validation and generated specification | `client/src/lib/workspace/layoutValidation.ts`, `client/src/generated/openui-spec.json` | Add semantic checks for bindings, actions, evidence, and continuity |
| Shared domain and mutations | `client/src/domain/`, `client/src/state/WorkspaceProvider.tsx` | Retain one mutation path for generated and dedicated views |
| Browser persistence and local service factories | `client/src/services/browserDatabase.ts`, `client/src/services/index.ts` | Add linked demo records and adaptive-session persistence |
| Task/calendar editing, preferences, drafts, undo | Existing widgets and services | Scope generated selections and drafts to the resolved goal |
| Saved generated layouts | `client/src/services/layoutService.ts` | Current saved response lacks a structured intent/binding envelope |
| Tests | `client/server/*.test.ts` | Cover the complete adaptive workflow and browser interactions |

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

### 1. Establish the contracts and behavioral baseline

- [ ] Add shared runtime schemas under proposed `client/src/domain/adaptive.ts` and pure validation helpers under `client/src/lib/workspace/planValidation.ts`.
- [ ] Define the first supported goals: meeting preparation, usage investigation, and overdue-work review. Return an understandable unsupported result for other goals without replacing the current canvas.
- [ ] Specify date semantics using the existing demo clock plus an explicit timezone. Resolve “tomorrow” once per request; keep date-only deadlines distinct from timestamped usage observations.
- [ ] Define partial follow-up semantics: inherit unchanged entity/date constraints; replace only explicitly changed constraints.
- [ ] Capture existing route, task/calendar control, persistence, and mutation behavior in focused regression cases before changing contracts.

**Acceptance:** schemas reject unknown entity references, invalid ranges, unsupported widget/action IDs, and malformed status unions. A follow-up such as “only blocked items” retains the prior project selection. Existing dedicated views still behave normally.

### 2. Add linked synthetic data without changing existing task fields

- [ ] Add typed clients, communications, issues, meeting records, usage observations/segments, and typed relationships in proposed `client/src/data/adaptiveDemo.ts` and domain schemas.
- [ ] Reuse existing project, event, task, and resource IDs where appropriate. Link records through a validated relationship collection: project-to-task, client-to-project, meeting-to-event, meeting-to-resource, and related communication/issue references.
- [ ] Use at least two clients/projects and two plausible upcoming meetings so relevance and ambiguity can be demonstrated. Include unrelated records, completed overdue tasks, blocked work, missing data, and a previous meeting.
- [ ] Add narrow service factories for these collections through the existing browserDatabase boundary. Reuse the collection helper and error/result conventions.
- [ ] Seed new collections only when missing. Preserve user-created domain records and malformed stored values according to existing persistence rules.
- [ ] Keep usage measurements separate from task-completion metrics. Seed a visible decline with segment differences and possible explanatory events; do not label correlation as proven causation.

**Acceptance:** every relationship resolves to a real fixture record. A Northstar selection excludes another client's records. Reload and seeding do not overwrite edited tasks/events/drafts. No task Context input or filter returns.

### 3. Implement intent resolution and clarification continuation

- [ ] Extract reusable provider-call behavior from `client/server/chat.ts` only as necessary; retain current provider configurations, cancellation, limits, and errors.
- [ ] Add a proposed intent resolver under `client/server/intent.ts`. The model receives the goal, bounded candidate entities, demo clock, timezone, and prior resolved intent, then returns schema-validated structured output.
- [ ] Extend the existing generation endpoint with a versioned result union: clarification, ready workspace, or unsupported. Keep transport errors distinct from valid unsupported/clarification results.
- [ ] Update `services/contracts.ts`, `generationService.ts`, and `hooks/useWorkspaceGeneration.ts` together. A clarification answer carries the request ID, original goal, retained resolution, and validated selected candidate.
- [ ] Introduce a small adaptive-session state hook for `DynamicWorkspace.tsx` rather than placing the full workflow inside the page component.
- [ ] Render a concise application-owned clarification control in the command dialog. Asking a question preserves the current dashboard. Enter/selection continues the original goal; cancel performs no domain mutation.
- [ ] If a candidate is removed or the question becomes stale, re-resolve instead of accepting an invalid answer. New goal submission supersedes pending clarification.

**Acceptance:** “Prepare tomorrow's meeting” asks which meeting when multiple candidates match. Choosing Northstar generates Northstar's preparation view without requiring the user to retype their goal. Cancellation, invalid answers, stale replies, and unsupported requests leave the last valid canvas usable.

### 4. Retrieve relevant records deterministically

- [ ] Add proposed `client/src/services/retrievalService.ts` operating on a resolved intent and a consistent browserDatabase snapshot.
- [ ] Meeting retrieval selects the meeting/event, client/project, previous meeting, relevant communications, open issues, linked tasks/resources, and usage summary if available.
- [ ] Usage retrieval selects the client/product, comparable periods and segments, measurement coverage, relevant communications/issues, and related work.
- [ ] Overdue retrieval selects linked tasks with due date before the demo date and status other than completed, with requested owner/priority/blocked filters.
- [ ] Produce typed evidence references and deterministic reasons for each selected group. Bound record counts and text sizes; expose missing data instead of inventing replacements.
- [ ] For the current browser-only storage model, send the selected snapshot and retrieval result to composition. Validate their schemas on the server. This is demo context, not an authenticated source of truth.
- [ ] After slow generation, resolve references against current local records again. If important referenced records changed or disappeared, refresh or reject the proposal with an understandable message.

**Acceptance:** identical intent and snapshot produce identical selected IDs. Unrelated clients' records never appear. Overdue excludes completed work. Usage comparisons disclose missing/zero baselines and do not invent percentages. Evidence links open the supporting record.

### 5. Bind reusable widgets to the resolved task

- [ ] Extend `WorkspaceWidget` in `OpenUIWorkspace.tsx` with a validated instance identity and binding reference. Extend registry metadata with supported binding/action capabilities.
- [ ] Add an application-owned binding resolver/provider shared by the generated renderer and widgets. Widgets receive resolved selections through typed props or a narrowly scoped provider; do not create a second record store.
- [ ] Update tasks, meetings, resources, context summary, timeline, availability, metrics, outline, and usage widgets incrementally. Existing unbound dedicated views keep their normal selection behavior.
- [ ] Separate generated-view constraints from global task filters. User filters can narrow the bound selection but cannot expand it into another entity's data.
- [ ] Compute counts, charts, recommendations, and availability using the same scoped records. Define scheduling availability scope explicitly so omitted busy events do not make a time appear free.
- [ ] Add focused communications/issues/evidence display components only where the existing resource/detail components cannot adequately support the task.
- [ ] Keep the existing single task widget, selected List/Kanban mode, component controls, and shared mutations. Regenerate the OpenUI specification through `npm run generate:openui`.

**Acceptance:** meeting preparation shows only linked records; overdue lists only matching open overdue tasks; generated metrics agree with displayed records. Editing/completing a bound task updates its dedicated view. List/Kanban switches show one representation. Empty selections show an explicit empty state.

### 6. Validate composition and explain adaptation

- [ ] Have composition return a structured WorkspacePlan with allowlisted widget types, bindings, stable identities, evidence, and layout constraints.
- [ ] Make the validated plan authoritative for productivity widgets. Prefer deterministic serialization of that plan into OpenUI; restrict any model-generated supporting content to a small approved set of primitives.
- [ ] Retain existing syntax validation and additionally reject unresolved IDs, duplicate task widgets, unsupported spans/actions, incompatible bindings, excessive widget counts, and evidence not present in retrieval.
- [ ] Provide an on-demand “Why this layout?” explanation through existing header/options patterns. Keep the default canvas minimal.
- [ ] Explain specific selections, for example “Two unfinished follow-ups from Northstar's previous meeting,” with inspectable evidence. Distinguish measured facts, deterministic recommendations, and model hypotheses.
- [ ] Replace the canvas only after full validation. Generation, validation, or persistence failures preserve the last valid canvas and report the practical failure.

**Acceptance:** invalid or invented references cannot reach the renderer. The view contains useful interactive components, not a generated essay. Each surfaced data group has an inspectable reason. Explanations do not claim unsupported causation or external synchronization.

### 7. Enforce continuity and working actions

- [ ] Normalize plans before render to enforce pins in application code, including generated responses rather than only the preset renderer.
- [ ] Preserve a pinned widget's binding and stable identity across follow-ups. Label retained scope when the new goal concerns another entity; do not silently rebind pinned content.
- [ ] Resolve capacity conflicts deterministically: keep pins, reject an over-limit proposal or remove lower-priority unpinned widgets, and explain the result. Never silently drop a pin.
- [ ] Scope drafts by purpose and stable entity, such as meeting agenda plus meeting ID. Include the matching draft buffer in relevant follow-ups and avoid exposing unrelated drafts to composition.
- [ ] Replace `DynamicWorkspace.tsx`'s generic `onAction` command-opening behavior with validated dispatch for supported generated actions and clarification answers. Inspect the installed renderer's action payload before defining adapters.
- [ ] Route task/event/draft/recommendation operations through existing services and validation. Do not execute mutations merely because generation mentioned an action.
- [ ] Preserve cancellation/request identity handling: an older response cannot overwrite a newer goal, reset, or clarification choice.

**Acceptance:** a pinned widget survives goal changes, an edited agenda survives switching away/back, and unrelated meetings have separate drafts. Completing a task and saving an agenda work from the generated layout. Invalid actions produce feedback without mutating records. Reset during generation cannot be undone by a late response.

### 8. Persist and migrate the adaptive session safely

- [ ] Extend `layoutService.ts` with a versioned envelope containing validated plan, resolved intent, compatible response/state, and pins. Keep domain records in their existing database storage.
- [ ] Define migration for current response-only saved layouts: preserve valid legacy content in a legacy mode or migrate only when bindings can be established safely. Never infer invented entity links from saved text.
- [ ] Restore pending clarification only if its candidates and version remain valid; otherwise preserve the prior canvas and ask again on the next submission.
- [ ] Reject incompatible/invalid saved envelopes with the current dashboard fallback and a dismissible notice. Do not silently overwrite the original raw value during load.
- [ ] Retain in-memory usability when storage fails. Reset layout clears adaptive session state without resetting task/event records or unrelated collections.

**Acceptance:** refresh restores the resolved goal, scoped layout, pins, and saved entity-specific drafts. Existing valid saved layouts remain usable. Malformed or unavailable storage causes no crash or destructive initialization. Layout reset preserves domain edits.

### 9. Verify the three-task demonstration and update documentation

- [ ] Add focused tests to existing `client/server/*.test.ts` or new files there for intent schemas, retrieval, bindings, semantic validation, action dispatch, continuity, and migration.
- [ ] Use mocked provider outputs for deterministic automated tests; keep a separate manual live-provider run to assess interpretation of unseen phrasing.
- [ ] Test browser flows on desktop and narrow mobile widths: command shortcut, clarification keyboard use, dialog focus, canvas focus after adaptation, evidence inspection, task edit, view selector, scheduling errors, persistence, and reset.
- [ ] Preserve the current canvas during loading; announce results and errors accessibly. Respect reduced motion and avoid focus loss when components move.
- [ ] Update README and service documentation to current routes, local persistence boundaries, supported goals, demo clock, setup, and known limitations.
- [ ] Record live evaluation results instead of reporting an unsupported completion percentage.

## Required demonstration script

| Step | Input/action | Required visible result |
| --- | --- | --- |
| 1 | Open `/` | Generic dashboard with working shared data |
| 2 | “Prepare tomorrow's meeting” | Focused clarification if multiple meetings match; dashboard retained |
| 3 | Select Northstar | Client/meeting overview, relevant communications/issues, linked tasks/resources, editable agenda |
| 4 | Edit and save agenda; pin a relevant widget | Saved draft and explicit pin state |
| 5 | “Investigate Northstar's product usage drop” | Real seeded usage periods/segments, supporting evidence, investigation actions; pin retained |
| 6 | Inspect evidence | Source record is visible; causal hypotheses are identified as hypotheses |
| 7 | “Review overdue Atlas project work” | Outstanding overdue Atlas tasks, blockers/owners, scoped counts, recovery actions |
| 8 | “Only blocked items” | Atlas/date scope retained; selection narrows; task appears once |
| 9 | Perform a task action; return to meeting preparation | Mutation visible elsewhere; saved Northstar agenda restored |
| 10 | Refresh; attempt invalid output or cancel a request | Session restored; failed/cancelled generation preserves valid UI |

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

- [ ] Three distinct goals change both layout and relevant content on the same workspace.
- [ ] Ambiguity is clarified and the answer continues the original task.
- [ ] References, counts, evidence, and actions are validated against actual local records.
- [ ] Each composition supports at least one meaningful working action.
- [ ] Follow-ups preserve intended entity/date scope, pins, and saved drafts.
- [ ] Reload restores compatible adaptive state; failed generation never replaces valid UI.
- [ ] Dedicated task/calendar pages, shared controls, and local mutations remain functional.
- [ ] Desktop/mobile/keyboard flows pass, automated checks pass, and live demo results are documented.
- [ ] Documentation accurately states local-only data, synthetic sources, supported goals, and remaining limitations.

**First implementation step:** introduce and test the adaptive contracts, then add the minimal linked Northstar/Atlas fixtures needed for a complete meeting-preparation workflow. Do not begin by adding more general-purpose pages or service stubs.
