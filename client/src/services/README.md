# Local service boundaries

Components use configured services from `@/services`; factories accept a shared `BrowserDatabase` for testing and future adapters. The browser currently supplies all business records. API payload validation does not replace backend authorization.

## Shared storage

`browserDatabase` owns task/event/draft state, collection reads/writes, subscriptions, persistence feedback, reset epochs and grouped transactions. Domain actions retain bounded activity and undo. Collection-only writes also notify subscribers. Transaction failures restore the prior state; storage failure may retain accepted changes in memory, so show persistence feedback rather than claiming remote durability.

- Domain records: `orlo-data-v2`.
- Collections: `{version: 2, collections: ...}` in `orlo-browser-db-v2`.
- Canonical `workspaceDocument`: version 3, active widget instances, pins, revision, text history, continuation and pending clarification.
- Layout adapter: version 3 in `orlo-layout-v3`.
- Display preferences: `task-view`, `calendar-view`, `calendar-category` and shared `pageViews`.
- Voice audio: IndexedDB; canonical note text remains in domain drafts.

There are no project/client collections, ownership fields, selected-project state or organization containers. `workspace` binding means all local records. A meeting binding identifies an actual meeting; usage identifies dates/segment; overdue identifies cutoff/filters. Different widget instances may retain independent presentation filters.

`localDataService.initialize()` gates app mounting. With no new stores, it awaits audio cleanup, removes only known old Orlo keys and installs empty records. Existing new stores are validated; invalid data is preserved until explicit Reset. Reset stops recording, awaits audio removal, clears owned preferences/layout keys and replaces records/collections, incrementing the epoch. Failed cleanup remains retryable. OAuth sessions, unrelated origin storage and remote events are untouched.

`demoSeedService.seed()` refuses nonempty record collections. It creates explicitly requested synthetic records with UUIDs and relative dates. It preserves extension preferences, imported plugins, pins and canvas state. No automatic seed, audio blobs or fake completion events are created.

## Services

| Service | Main interface / responsibility |
| --- | --- |
| Tasks | `list`, `getById`, `create`, `update`, `save`, `delete`, `toggle`; validation, shared mutations and undo |
| Events | `list`, `getById`, `create`, `createWithId`, `update`, `save`, `delete`; local calendar validation; meeting metadata and canonical agenda synchronization |
| Notes | `list(query)`, `getById`, `create`, `update(input, expected)`, `setPinned`, `duplicate`, `delete`; metadata plus canonical draft body, optimistic conflicts |
| Drafts | `get`, `save`, `delete`; stable meeting/investigation keys and note metadata; rename titles through Notes |
| Resources | Local CRUD; direct task/meeting relationships through resource module service |
| Adaptive data | Validated meeting/communication/issue/relationship CRUD, `snapshot`, `loadCandidates`, `loadPreparation` |
| Usage data | Observation/release CRUD, `loadCatalog`, validated JSON import, `snapshot`; unique date/segment observation grain |
| Usage investigation | `load({dateRange?, segment?})`; chart series, endpoint/period comparisons, coverage, sources and explanations |
| Usage workspace | `load(intent)`; selected measurements/releases and only directly related work/resources/issues/communications |
| Overdue review | `load(intent, referenceDate)`; incomplete tasks due before the cutoff, within date/filter scope; directly linked resources |
| Intent | Async `resolve(request, {signal})`; HTTP resolver, strict version-2 contracts and reference validation |
| Composition | Meeting/usage/overdue snapshot validation, evidence validation, serialization and scoped actions |
| Workspace actions | Prepare/revalidate edits, canonical drafts, scheduling and goal changes; immutable originating binding/revision/pin identity |
| Workspace document/store | Initialize/load/save, one shared in-memory document, bounded layout undo, restored clarification, interrupted-request recovery |
| Pins | Stable saved instances, immutable bindings, local view-state changes, idempotent pinning and retained scopes |
| Scheduling | Availability, recommendations, focus/planner services; conflict checks and explicit confirmation |
| Analytics/search/activity | Derived views over the same local records |
| Files | `upload(blob, name)`, list/download/delete; local 2 MB limit and epoch cancellation |
| Extensions | Persisted availability, timer lifecycle, voice/audio lifecycle and isolated plugin import |

Profile, auth, sharing, notification and local calendar-integration factories remain local interfaces. They do not implement cloud accounts, email delivery, collaboration or access control. The separate Google Calendar API implements external authorization and server-owned preview/confirmation operations.

## Intent, retrieval and continuity

The version-2 intent request contains request identity, goal, current local reference date, timezone, meeting candidates and optional usage extent/segments. Responses are resolved, needs_clarification or unsupported. Resolved goals require dates; meeting preparation additionally requires a candidate meeting ID. Clarification answers retain the original question, offered choices and partial intent.

Explicit refinement changes preserve omitted fields. Meeting switches derive their date. Removing required dates asks again rather than inventing dates. Usage can change dates/segment; overdue can refine owner/status/priority. New goals do not inherit unrelated workflow scope. Pins are excluded from implicit targeting and never acquire a new binding from a follow-up.

Meeting retrieval uses direct meeting→task/resource links, meeting IDs on communications/issues, and an explicit earlier previous-meeting relationship. Dedicated-page task filters do not hide meeting tasks. Usage retrieval follows observation/release→supporting-record links. Overdue retrieval filters shared outstanding tasks and follows task→resource links. Names/titles are display text, not join keys.

Composition explanations must reference IDs present in the selected snapshot. Required widgets remain enforced. Source changes during generation invalidate stale output; failure preserves the previous canvas. Empty collections do not produce invented evidence or fabricated statistics. Missing observations are unknown, zero baselines yield no percentage, and release timing is descriptive rather than causal.

## Notes and extensions

General notes use `note:<id>`, agendas `meeting-agenda:<meetingId>`, investigations a stable date/segment key, and Google preparation notes account/calendar/event-qualified keys. Note metadata has a stable ID, title, kind, pin/timestamps and optional meeting/date/segment references. Text has one saved body in drafts. Autosave buffers are preserved on conflicts and invalidated by reset epochs.

Quick Timer has optional task association, no project requirement, explicit controls and deduplicated completion records. Disabling pauses it; re-enabling does not resume automatically. Voice Note requires explicit recording permission, retains a captured unsaved draft within the session, and saves text through Notes with audio in IndexedDB. Disabled extensions cannot be newly generated; saved widgets show enable/remove placeholders. Existing saved audio plays while Voice Note is disabled.

## Future backend

Keep these boundaries but replace local persistence with authenticated, user-scoped asynchronous adapters. Resolve IDs and permissions on the server; never trust client-provided snapshots as authorized records. Define loading, conflict versions, cloud audio and undo behavior before switching adapters. Browser storage currently provides neither cross-device nor automatic cross-tab synchronization.

Verification: `npm test`, `npm run build`, `npm run lint`, `npm run test:render`; optional browser scripts are listed in the root README. Live provider and full accessibility acceptance remain separate from mocked tests.
