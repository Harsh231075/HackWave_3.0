# Orlo browser services

`index.ts` exports one configured `browserDatabase` and the services that use it. Factories accept an injected database or storage adapter for tests. Imports never load or write browser data.

## Shared database

`browserDatabase.ts` owns the current workspace state, subscriptions, domain reducer, undo history, and persistence writer. `WorkspaceProvider` subscribes with `useSyncExternalStore`; it no longer owns a separate reducer or saves competing snapshots. Direct service mutations therefore update standard pages and generated widgets immediately.

- `getState()` returns the current stable workspace snapshot for subscriptions/internal reads.
- `subscribe(listener)` returns an unsubscribe callback.
- `dispatch(action)` applies domain actions, persists domain records, and notifies subscribers.
- `replaceRecords(snapshot)` validates a replacement snapshot before applying it.
- `reset()` restores the demo domain records.
- `readCollection(key)` / `writeCollection(key, value)` handle additional local entities.
- `getPersistenceResult()` reports whether the latest write was saved, invalid, or unavailable.
- `storage` is the shared adapter used for legacy layout and preference keys.

Workspace records retain `gogpt-workspace-v1`. Layout retains `gogpt-app-layout-v1`; preferences retain `task-view`, `calendar-view`, and `calendar-category`. Additional collections live in a versioned `orlo-browser-db-v1` record. Reads preserve malformed saved data. Failed storage writes leave valid edits usable in memory.

## Service catalog

| Service | Methods | Data and behavior |
| --- | --- | --- |
| Workspace | `load`, `save` | Shared domain snapshot |
| Tasks | `list`, `getById`, `create`, `update`, `save`, `delete`, `toggle` | Tasks/todos, existing filters, domain validation |
| Events | `list`, `getById`, `create`, `update`, `save`, `delete` | Calendar, meetings, timeline; range/category filters and conflicts |
| Drafts | `get`, `save`, `delete` | Shared editable outlines |
| Activity | `list` | Existing bounded domain activity; optional limit |
| Availability | `isAvailable`, `findSlots` | Derived from the same event records; device-local scheduling |
| Recommendations | `list`, `accept`, `dismiss` | Local focus suggestions; acceptance creates a shared event |
| Analytics | `getTaskSummary`, `getOverview` | Counts and scheduled minutes derived from current records |
| Search | `search` | Matching tasks, events, and resources |
| Resources | `list`, `getById`, `create`, `update`, `delete` | Demo resource seeds and locally stored edits |
| Layout | `load`, `save`, `clear` | Validated generated OpenUI response |
| Preferences | `load`, `save` | List/Kanban and calendar display settings |
| Generation | `generate` | Existing generation endpoint; shared records passed as context |
| Profiles | `list`, `getById`, `create`, `update`, `delete`, `getProfile`, `updateProfile` | Local names, optional email, timezone |
| Projects | `list`, `getById`, `create`, `update`, `delete` | Local project metadata; tasks have no context field |
| Notifications | `list`, `getById`, `create`, `update`, `delete`, `markRead`, `getSettings`, `updateSettings` | Local messages and settings; no reminder delivery engine |
| Auth | `getSession`, `selectLocalProfile`, `signIn`, `signOut` | Browser-only profile selection; real sign-in returns unavailable |
| Calendar integrations | `listConnections`, `saveConnection`, `disconnect`, `connect`, `sync` | Disconnected local metadata; external connection/sync returns unavailable |
| Sharing | `listMembers`, `addLocalMember`, `removeMember`, `invite` | Local member references; email invitations return unavailable |
| Files | `list`, `upload`, `getDownloadUrl`, `revokeDownloadUrl`, `delete` | Local attachment content, maximum 2 MB per file |

Task/event/draft commands preserve existing activity and 20-step undo behavior. Deleting tasks and drafts is also undoable. Undo does not include additional profile/project/file collections. Demo reset changes domain records only; layout reset changes layout only.

## Usage

Import configured services from `@/services`. Mutation results are `{ ok: true, value }` or `{ ok: false, message }`. Local mutation success means the record was accepted in memory; check the database persistence result when presenting save guarantees. Read methods return copies of entity records.

Existing UI is connected to task/event/draft mutations, task/calendar queries, availability, metrics, resources, recommendations, activity, preferences, layouts, and generation. Additional feature services are callable local interfaces with tests; new account/upload/sharing/settings screens are not introduced by this refactor.

Authentication does not authenticate users or enforce access control. Local member records do not transmit or share data. Calendar metadata does not authorize an external calendar. Notifications do not send messages. `signIn`, `invite`, `connect`, and `sync` return explicit unavailable results instead of pretending to perform external operations.

File uploads read a Blob and store its content locally. Download URLs are temporary blob URLs; the caller must revoke them with `revokeDownloadUrl` when finished. Storage quota failures can make attachments session-only.

`api/httpClient.ts` centralizes JSON HTTP responses, service errors, and cancellation. Generation, intent resolution, and meeting composition use the shared HTTP client. Later backend adapters must define asynchronous loading, server IDs, server-authoritative scheduling, and remote undo explicitly. Browser storage is local to this browser; there is no cross-device or automatic cross-tab synchronization.

## Structured intent boundary

`createIntentService(resolver)` creates an asynchronous `IntentService.resolve(request, { signal })`. The required injected resolver can later be a local interpreter or HTTP adapter. The configured `intentService` uses `/api/intent`; existing general workspace generation remains available.

The version-1 request contains `requestId`, `goal`, `referenceDate`, IANA `timezone`, and a candidate catalog (`clients`, `projects`, `meetings`). Optional `previousIntent` supplies resolved follow-up scope. Optional `clarificationAnswer` contains the original question identity and either an entity selection or an inclusive date range. Its required `clarificationContext` preserves offered choices and partial intent. Meeting candidates contain dates and optional client/project links; project candidates may link to a client. Callers supply these catalogs; the service does not read browserDatabase or infer links from record names.

The response echoes `version`, `requestId`, and `originalGoal`, and uses one status:

- `resolved`: `intent` contains a supported `goalType`, entity IDs, inclusive `dateRange` (`from`, `to`), and optional owner/status/priority constraints. Meeting preparation requires a meeting, usage investigation a client, and overdue review a project.
- `needs_clarification`: `question`, `field`, `choices`, and `partialIntent`. Entity questions have at least two distinct catalog choices; date-range questions have no entity choices.
- `unsupported`: an explanatory `reason`.

Schemas and inferred types live in `domain/intent.ts`. `validateIntentResolution` performs request-aware reference checks after syntax validation. Impossible dates, reversed ranges, unknown IDs, contradictory relationships, unexpected properties, and mismatched response identity are rejected. Validation trims text without changing caller objects. It does not interpret goals, merge follow-ups, resolve relative dates, or continue a clarification.

The service validates requests before calling its adapter and validates responses afterward. Invalid inputs throw `ServiceError` with code `input`; invalid responses use `response`. Adapter/network errors and cancellation retain their meaning. Unsupported goals and clarification are successful domain responses. The HTTP adapter receives the normalized request and abort signal and returns the same validated union. No records are written or UI actions executed. Import the factory/types from the service entry point; server/tests can import the pure modules directly without initializing the browser service graph.


## Linked adaptive data and meeting composition

`adaptiveDataService` exposes client/project/meeting/communication/issue/relationship collections with validated local CRUD. Configured aliases (`clientService`, `projectService`, `meetingService`, `communicationService`, `issueService`, `relationshipService`) share browserDatabase. Adding metadata does not restore task Context fields or replace existing domain records. Projects accept an optional client ID for legacy compatibility.

`candidateCatalogService.load()` returns `LoadResult<IntentCandidates>` built from current clients/projects/meetings. Linked calendar events supply current meeting title/date/times/participants/agenda. Deleted linked events remove those meetings from the catalog. Invalid saved collections produce `invalid`; dangling references are excluded. All reads return copied validated records.

`meetingPreparationService.load(meetingId)` returns `LoadResult<Preparation>`: client/project/meeting, explicit task/resource links, the latest linked previous meeting, ten recent project communications, open issues, and deterministic selection reasons. Project and direct meeting links are deduplicated. A record explicitly assigned to another project is excluded. Missing/deleted records are never regenerated during a read.

`meetingCompositionService.compose(input, { signal })` posts a resolved intent, scoped snapshot, agenda and optional previous composition to `/api/workspace/compose`. The result uses at most seven unique approved widget types with context/outline required. Each widget has a span, concise reason, and source references checked against the supplied snapshot. Application code serializes this plan into OpenUI; the model does not create executable handlers. Scoped components use the original task/draft services.

Meeting agendas use `meeting-agenda:${meetingId}`. Saved drafts persist; transient edit buffers remain session-only. `layoutService.loadSession()` supports legacy version-1 responses and version-2 meeting sessions. `saveMeeting()` validates consistency between meeting ID, intent, composition and serialized response. Restore revalidates supporting references against current local records. Layout reset clears the session, not domain records.

The command workflow uses `/api/intent` before composition. Clarification answers require matching offered context and current catalog IDs; date answers use labeled date inputs. Cancel/reset/new requests prevent stale results from applying. Supported pins missing from composition remain scoped; unsupported pinned widget types are labeled as showing all workspace records. Pins themselves remain session-only.

The fixed demo clock is 2026-10-12 in Asia/Kolkata. Model calls are server-side and use the existing configured provider. Meeting, usage and overdue goals use their respective scoped retrieval/composition workflows. No new external integration or authenticated data source is introduced.

## Project overdue reviews

- `overdueReviewService.load(intent, referenceDate)` validates an overdue intent and retrieves only explicit, non-conflicting project→task/resource relationships. Completed, today/future and out-of-range tasks are excluded. Results are deterministic, and missing/invalid/valid-empty results remain distinct.
- `overdueCompositionService.compose(request, { signal })` sends the `kind: "overdue"` contract to `/api/workspace/compose`. Only five registered widget types are allowed; context and one tasks component are mandatory. Evidence must exist in the current selection. The hook revalidates after generation to reject stale sources.
- `focusSchedulingService.findSlots({ taskId, date, intent })` returns an ActionResult with actual-duration slots; `schedule({ taskId, date, start, intent, expectedDuration })` revalidates before creating an idempotent focus event through eventService. Every calendar event and unlinked meeting is busy time. Invalid saved scheduling data is unavailable.
- `layoutService.saveOverdue(session)` writes a version-2 scoped session with intent, cutoff, validated composition and local task refinements. Version-1 general and version-2 meeting sessions remain readable. Reload recomputes current records rather than restoring stale task snapshots.
- `createRecordStore` supplies stable external-store snapshots for both domain edits and collection changes. Overdue filters are separate from dedicated task-page filters and can only narrow the bound selection. Pins remain session-only; incompatible pinned widgets are labeled as all-workspace records.

The meeting compose request retains its existing wire shape. Overdue requests use the explicit `kind` discriminator; both are validated by the same endpoint. No backend database, authentication or external integration was introduced.

## Usage measurements and investigation

- `usageDataService.loadCatalog()` returns validated clients and owned projects. `usageObservationService` and `usageReleaseService` expose collection CRUD with schema/ownership checks; measurements reject duplicate project/date/segment grains.
- `usageInvestigationService.load({ clientId, projectId?, dateRange?, segment? })` selects observations/releases from browserDatabase. Missing entities, malformed collections, and valid empty results remain distinct. Date ranges are inclusive and bounded to 366 days. Collections are bounded to 10,000 observations and 1,000 releases.
- `loadIntent(intent, segment?)` adapts a validated usage intent to the same retrieval logic; constraints.segment supplies the segment when an explicit override is absent.
- Results contain chart series, endpoint and equal-length period comparisons, coverage, source observations/releases and deterministic explanations. Client-wide aggregation requires measurements for each selected project; absent project/day/segment data is `null`, not zero. A missing endpoint or zero baseline never produces a fabricated percentage.
- UsageExplorer subscribes to collection changes through `createRecordStore`, so local data edits immediately refresh charts and explanations without relying on task/event mutations. Widgets contain no fixed client, date, segment, measurement or release conclusion.

Synthetic Northstar/Westbridge values live only in `data/usageDemo.ts`, added to the existing seed collections. Source labels distinguish synthetic from manual records. Existing domain records, malformed storage and intentionally empty usage collections are preserved.

### Scoped usage workspace

- `usageWorkspaceService.load(intent)` combines filtered observations/releases with explicit, non-conflicting project→task/resource links, communications inside the requested dates and current open project issues. Issues have no date field; they are supporting project context, not period evidence.
- `usageCompositionService.compose(request, { signal })` sends the validated `kind: 'usage'` snapshot and only the matching investigation draft. Composition permits eight registered widget types, requires context/usage once, and validates evidence against supplied records.
- Usage follow-ups include `scopeChanges` (clientId/projectId/dateRange/segment). Application logic preserves undeclared fields, handles segment clearing and updates project-client ownership before full intent validation.
- `layoutService.saveUsage(session)` stores version-2 intent/composition, isolated task filters and an evidence fingerprint, not record/metric snapshots. Reload restores previous usage composition for follow-ups and recomputes data. Valid empty selections retain the usage layout.
- UsageScopeProvider subscribes to domain and collection changes. Bound controls cannot silently switch to another client/project; scope changes go through the command window. The independent UsageExplorer still provides dependent selectors.
- Equal-period averages compare the first and last floor(days/2) days; odd middle days are excluded. Missing coverage makes a period average unavailable, and zero baselines never produce a percentage. Endpoint comparisons are separately labeled.
- Investigation drafts use `usage-investigation:<clientId>:<projectId-or-all>`; they never overwrite meeting agendas. Usage pins preserve the original client/project, dates and segment across goals and reloads, while continuing to read current records.

### Meeting task filters

MeetingScopeProvider applies the saved meeting session’s taskFilters directly to retrieved meeting-linked tasks using the demo clock. Dedicated/global filters are neither read nor updated. Context, agenda, resources and evidence continue using the complete preparation snapshot.

Version-2 meeting sessions now include validated taskFilters; missing filters in older sessions default to emptyFilters without rewriting storage. Explicit invalid values/dates are rejected, preserving raw data. saveMeeting accepts MeetingLayoutInput for older callers, while loadSession returns normalized MeetingLayout. Filters persist on reload and successful same-meeting follow-ups; switching meetings or returning after a different goal starts fresh. Local changes do not remount the canvas or clear draft buffers. Save failures retain the in-memory selection and display a persistence notice.


### Persistent pinned views

`pinService` owns `loadPins`, `pinWidget`, `unpinWidget`, `updatePinViewState` and `clearPins`. Mutations return either an actionable failure or the updated pins plus their persistence result. A storage failure keeps accepted operations in memory. Invalid pin collections remain untouched until explicit Clear pins; a malformed outer database is never overwritten.

Pins capture validated selections, filters, layout span and provenance rather than record snapshots. Stable UUIDs survive local filter edits and reloads. Meeting agendas and investigation notes use their original entity-specific draft keys. Calendar changes inside pins remain local; List/Kanban remains shared. Deleted or reassigned meeting records produce an unavailable card rather than silently changing scope.

The adaptive canvas reserves six pin slots within a fourteen-widget limit, deduplicates equivalent views, preserves required active widgets, and trims optional content in requested order. The stored response is retained so omitted widgets return after unpinning. Dedicated pages do not append pins. Reset layout preserves pins; Clear pins and demo reset remove them.

Verification: run `npm test`, `npm run build` and `npm run lint` from `client`. The optional browser harness runs with `node scripts/verify-pins.mjs` when Playwright is available. Otherwise set `ORLO_PLAYWRIGHT_MODULE` to an installed Playwright module path and optionally `ORLO_CHROME_PATH` to a Chromium executable. The harness starts/stops its own Vite server, uses a fresh browser context and mocks model endpoints; it does not require an API key or modify the user's browser data.


## Generated actions

`workspaceActionService.prepare(payload, origin)` validates one of four strict action contracts and returns an app-owned editor descriptor or goal change. Origin contains binding, demo reference date, current layout revision and optional pin identity; models cannot supply it. `loadActionScope` retrieves base records independently of task view filters. Meeting/usage drafts derive their keys from ownership; overdue/manual usage have no draft action.

`saveTask(prepared, input)` checks current scope and the full task captured at open before calling the existing task service. `saveDraft(prepared, value)` rejects changes to the saved draft or originating metadata, preserving the shared unsaved buffer. The React host also rejects stale revisions and pending generation; unpin/layout replacement dismisses those editors. Mutations retain existing persistence, activity and undo behavior.

`focusSchedulingService.findSlots` and `schedule` now accept `{ taskId, date, binding }` as well as the legacy overdue `{ taskId, date, intent }`. `schedule` additionally requires `start` and `expectedDuration`. It re-reads current scope/status/duration and calendar/meeting conflicts. A matching existing stable-ID focus event is idempotent; a different event or newly occupied slot is rejected without overwrite.

Optional composition `actions` entries contain only `{ label, action }` (maximum four). Structured output validates scoped task references before serialization; execution validates them again. The general-layout validator also rejects unsupported external/tool action plans before installation. Unsupported saved legacy controls remain readable and cannot execute application mutations through the renderer fallback.
