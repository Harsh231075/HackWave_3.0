# Orlo — Adaptive Productivity Workspace

HackWave 3.0 · PS 4: Human-Centered AI / Intent-to-Interface

Orlo starts with a generic dashboard at `/`. Ctrl+K (Cmd+K on macOS) opens the command window. A meeting-preparation request resolves the meeting, clarifies ambiguity, retrieves explicitly linked records, and asks the configured AI provider to arrange approved interactive widgets. There is no chat transcript.

## Current capabilities

- Shared white interface, local Figtree typography, reusable sidebar and page controls.
- Tasks with List/Kanban selection, calendar scheduling, shared edits, validation, undo, resources, and drafts.
- Device-local browserDatabase services and saved generated layouts.
- Structured intent resolution through `/api/intent`, including entity/date clarification.
- Two synthetic clients (Northstar and Westbridge), projects, upcoming/previous meetings, communications, issues, and explicit task/resource links.
- Meeting-specific preparation with AI-selected widget order/spans, validated source references, and separate editable agendas.
- Project-scoped overdue reviews, isolated local refinements, matching metrics, and available-slot focus scheduling with explicit confirmation.
- Service-backed usage explorer with client/project/date/segment filters, calculated endpoint comparisons, measurement coverage, release records, and editable persisted source collections.
- Last valid canvas retained on provider errors, invalid output, cancellation, and unsupported goals.

The meeting workflow is scoped to actual supplied records. Usage investigation retrieves owned measurements and related work, validates composition, preserves scope across follow-ups and restores saved layouts. AI interpretation requires configured model credentials. Automated checks use mocked providers and do not certify live-model accuracy.

## Try overdue review

1. Press Ctrl+K/Cmd+K and enter **“Review overdue Atlas work.”**
2. Only Atlas’s overdue onboarding task appears; tasks due today, completed work, and Launch tasks are excluded.
3. Enter **“Only blocked tasks”**, then **“Show all overdue tasks”** to refine the same project and cutoff.
4. Edit the blocker to Pending, then choose **Schedule focus** in Recovery suggestions. Select a date and an available slot; confirm the task, duration, and exact time.
5. Complete or move the due date of a task to remove it from the review. Undo restores the record. Refresh preserves the review and local task filters, including valid empty results.
6. Enter **“Review overdue Launch work”** to switch project and client. “Review overdue work” can ask which project.

Scheduling checks the entire local calendar and unlinked meeting metadata, with 30-minute starts between 09:00 and 18:00 and the task’s actual duration. Blocked tasks require editing first. Focus events use stable task IDs, remain undoable, and never complete tasks automatically. Owner names can be searched; there is no owner-ID directory yet. Layout reset preserves tasks, events and meeting agendas.

## Try meeting preparation

1. Open `/`, then press Ctrl+K/Cmd+K.
2. Enter **“Prepare tomorrow’s meeting.”**
3. Choose Northstar or Westbridge if the resolver asks which meeting.
4. Inspect linked tasks, resources, communications, and open issues; use each widget’s information button for supporting records.
5. Edit and save the meeting agenda. Switch meetings and return; agendas are keyed by meeting ID.
6. Refresh to restore the scoped layout and saved draft.

The deterministic demo reference date is **2026-10-12**, timezone **Asia/Kolkata**. Both upcoming demo meetings are on 2026-10-13. Relative dates use this reference, not the real date. Source data is synthetic and is not retrieved from a real CRM, inbox, or calendar integration.

Existing saved collections are preserved. A previously saved empty/deleted projects collection is not overwritten with the demo projects; therefore those meetings may be absent. Malformed saved data produces an error rather than being silently replaced. Use a separate browser profile/site storage for a fresh demo without discarding existing records.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Default dashboard and adaptive workspace |
| `/landing` | Landing page |
| `/tasks`, `/calendar`, `/meetings`, `/planner`, `/priorities` | Dedicated shared component views |
| `/workspace/:mode` | Predefined composition previews |
| `/dev/components` | Component/state gallery |
| `/insights` | Redirect to `/` |

No profession modes or role partitions are used. Task records have no free-text Context field; adaptive selection uses explicit record relationships.

## Local setup

Use Node.js 24 and npm:

```bash
cd client
npm ci
```

Copy `client/.env.example` to `client/.env.local`, select a provider and configure its key/model, then run:

```bash
npm run dev
```

Provider transport supports OpenAI, Groq, Ollama, and the configured gateway. Credentials stay server-side; do not put keys in `VITE_*` variables. Without provider configuration the standard local views work, while generation reports unavailable configuration.

For the production server:

```bash
npm run build
npm start
```

The server serves the SPA and APIs together. Vite development middleware exposes the same APIs; `npm run preview` alone does not serve those APIs.

## API and data boundaries

| Endpoint | Contract |
| --- | --- |
| `POST /api/intent` | Versioned intent request → resolved / needs_clarification / unsupported response |
| `POST /api/workspace/compose` | Resolved meeting intent + scoped snapshot → validated widget composition and evidence |
| `POST /api/generate` | Existing general generation request → OpenUI response |

The browser owns the local record snapshot. Server validation checks payload consistency but does not authenticate it or make it a trusted remote database. Generated output cannot execute mutations; interactive components use existing local services.

Local records belong to projects. A fresh install creates one empty Default project with a persisted ID. The sidebar selects the project for Tasks, Meetings, Notes, Resources and Planner; generated canvas bindings retain their own goal scope. Notes have metadata and one canonical saved body, including meeting agendas. Records and the canvas persist locally; unsaved draft buffers last for the current session. Settings → Reset local data clears local projects, records, notes, attachments, layout, pins, history and preferences. Google Calendar credentials and remote events are unaffected. Settings → Seed sample data explicitly installs two linked sample projects only when the database is empty.

Authentication, sharing, external calendar connections, notification delivery, and cloud synchronization are not implemented. Their local service boundaries do not claim external functionality.

## Validation

Run inside `client/`:

```bash
npm test
npm run build
npm run lint
```

The test suite covers intent schemas, clarification validation, provider transports, linked retrieval, composition evidence, persistence compatibility, shared mutations, and error paths. Browser checks additionally exercise the meeting selection/agenda flow, keyboard access, reload, and mobile layout. Live-provider evaluation requires credentials and remains separate from deterministic tests.

Meeting milestone validation recorded for this implementation:

| Check | Result |
| --- | --- |
| Service/domain/API tests | 69 passed |
| Production build and TypeScript | Passed; existing large-chunk warning remains |
| Lint | Passed with existing warnings |
| Mocked desktop/mobile browser flow | Passed: clarification, client isolation, evidence, shared task edits, List/Kanban, separate agendas, reload, date answers, cancellation, invalid/unsupported output, collection updates, pins, and layout reset |
| Live configured Groq flow | Passed: ambiguous request → Northstar selection → AI composition → scoped records → agenda save/reload |

This verifies the meeting milestone, not the full three-task PS 4 demonstration.

See [PLAN.md](./PLAN.md) for the roadmap and [services documentation](./client/src/services/README.md) for factory interfaces and local storage behavior.

Structured intent/composition responses default to 768 output tokens. Set `MODEL_STRUCTURED_MAX_TOKENS` (256–8192) in server environment settings if your provider supports a larger budget or returns truncated layouts. Provider errors preserve the current canvas.

## Verify usage data cleanup

Open `/workspace/usage` (or select Usage in `/dev/components`). Choose a project and optionally filter by one of its clients. Projects can have no clients or multiple clients. Segment choices come from stored measurements, and inclusive From/Through filters apply when both dates are supplied. Chart values, accessible summaries, endpoint comparisons and source tables all use the selected records. Missing observations stay unknown, zero baselines have no percentage, and release timing is not presented as causal proof.

`usageObservationService` and `usageReleaseService` provide local CRUD through browserDatabase. Records are one measurement per project/date/segment and require consistent client/project ownership. Source collections seed only when missing; existing edits and empty collections survive reload. Comparisons show labeled endpoints and equal-length early/late period averages within the selected dates; odd middle days are excluded and incomplete coverage prevents a percentage. AI usage investigation is connected to resolved intent, linked project work and saved sessions.

## Verify adaptive usage investigation

On `/`, press Ctrl K (Cmd K on macOS) and enter: “Investigate Northstar Atlas usage from October 5 to October 11, 2026.” The configured model chooses a validated layout with scoped usage records. Follow with “Focus only on mobile usage”; the application retains the client, project and dates. “Show all segments” clears the segment constraint.

Optional investigation notes use a separate client/project draft; save it and reload to verify persistence. Linked tasks remain editable through shared task services, with separate usage-view filters. Chart figures and equal-period comparison metrics recompute from browserDatabase records. Source inspection shows supporting records; release timing never proves causation. Unavailable storage, invalid evidence or source edits during generation preserve the existing canvas.

The full continuous three-goal and accessibility evaluation remains tracked in PLAN.md.

Scoped usage validation: 100 automated tests passed; production build/TypeScript and lint passed (existing warnings remain). Mocked browser checks include a continuous meeting → usage → overdue → meeting sequence with retained edits and a pin. The configured Groq usage flow passed intent/composition, reload and segment inheritance; a quota-limited request succeeded after the verification harness retried.


Generated workspace buttons use four validated actions: edit a linked task, edit the originating agenda/notes, schedule focus through an available-slot confirmation, or immediately change the goal. Application code owns their scope and draft keys. Filters cannot hide a task from action validation; retained pins use their original meeting/project. Changed/deleted records and conflicting saves produce feedback without overwriting data. Optional actions are persisted with scoped layouts; old layouts without actions remain compatible.

For deterministic browser verification, run `node scripts/verify-actions.mjs` from `client/` with an externally installed Playwright (or set `ORLO_PLAYWRIGHT_MODULE` and `ORLO_CHROME_PATH`). It starts/stops its own Vite server, uses fresh browser storage and mocked model responses, and requires no API key. Live-provider and comprehensive accessibility evaluation remain separate.

## Unified workspace

The dynamic workspace and static previews render the same typed widget instances through one registry and binding host. A widget type identifies a component; a stable instance ID identifies its independently scoped view. Natural-language add, remove, move, resize, replace, and filter requests update one workspace document. Ordinary changes retain other views and scoped pins. Ambiguous requests ask which view to change; explicit clear can leave an empty workspace.

The `workspaceDocument` collection in `orlo-browser-db-v1` stores active instances, scoped pins, a revision, text conversation history, and follow-up targets. Tasks, local events, and drafts remain separate domain records. The project data version prevents older unowned records from being reused. Incompatible or malformed local data shows a recovery screen until Settings → Reset local data. Reset replaces the entire local database rather than migrating old sample records. Storage failures show feedback and retain valid edits for the current session. Layout undo preserves conversation history and does not undo external events.

Google Calendar bindings explicitly identify their account and primary calendar. Disconnected or different accounts show placeholders, never demo substitutes. Local focus scheduling uses the shared validated action dialog; Google scheduling uses server-owned preview and confirmation operations. See [Google Calendar setup](GOOGLE_CALENDAR_SETUP_AND_TESTING.md).

Checks: `cd client && npm test && npm run test:render && npm run build && npm run lint`. The render check covers the unified default/static canvas and independent project views; mocked API tests cover OAuth and event creation. Real Google authorization still requires configured credentials and a browser.

## Project data verification

`npm test` covers empty initialization, project ownership, multi-client associations, canonical notes/agendas, explicit sample seeding and reset/recovery. `npm run test:projects` provides optional Playwright checks for project switching, local task creation, note creation, reload, Reset/Seed and incompatible storage recovery. It uses the same `ORLO_PLAYWRIGHT_MODULE` and `ORLO_CHROME_PATH` overrides as the Kanban browser checks. Historical fixed fixtures live under `client/server/fixtures/`; the application does not import them.

Project notes are available at `/notes`: a New note header button, creation form and Keep-style card grid,
project-scoped search, pinning, autosaving text editor, duplication, Markdown
export and confirmed deletion. Meeting agendas and investigation notes share
canonical content with their adaptive components and cannot be deleted independently.
Notes are stored locally; no cloud sync or multi-user collaboration is provided yet.

Settings → Seed sample data installs two linked sample projects, each with eight tasks, ten local calendar events, ten notes (including a pinned note), four resources, four communications and three issues. Dates are relative to the day of seeding. Today includes meetings, focus blocks and a break with free gaps for scheduling; previous meetings have matching calendar events. Clearly labeled sample completion history populates activity and progress views. Web/mobile usage observations and release records support the investigation demo. Existing records must be explicitly reset before reseeding; Google Calendar data is never simulated.
