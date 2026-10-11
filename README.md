# Orlo — Adaptive AI Workspace

HackWave 3.0 · PS 4: Human-Centered AI / Intent-to-Interface

Orlo starts with a generic dashboard at `/`. Ctrl+K (Cmd+K on macOS) opens the command window. A goal resolves into a structured intent, retrieves relevant records, and asks the configured model to arrange approved interactive components. Follow-ups refine the current scope; failed generation keeps the last valid canvas.

## Current product

There are no project, client, organization, or membership containers. Tasks, notes, local calendar events, meetings, resources and usage records are shared local collections. Free-text owners and participants remain. Task Context has been removed; relationships use explicit record IDs.

- Tasks: one List or Kanban view, drag and drop, editing, filters, undo and focus scheduling.
- Notes: cards, search, New note dialog, autosave, pinning, duplication, export and guarded deletion. Meeting agendas and investigation notes use the same canonical saved bodies.
- Meetings, calendar and planner: reusable components with their own controls and dedicated page header actions.
- Adaptive meeting preparation: meeting selection, directly linked work/resources, recent meeting communications, open issues, explicit previous meeting and editable agenda.
- Usage investigation: stored observations/releases filtered by date and segment, derived comparisons, missing-data disclosure and evidence-linked work. Release timing does not establish causation.
- Overdue review: outstanding overdue tasks filtered by dates, owner, status and priority; resources linked to selected tasks.
- Saved layouts: stable widget instances, scoped pins, independent view filters, history and follow-up clarification survive reloads without regenerating on navigation.
- Optional extensions: Quick Timer, Voice Note and Calculator, OFF initially. Disabled saved widgets offer enable/remove controls. Imported static HTML plugins run in isolated frames. Stopwatch and Whiteboard are Coming Soon.

## Local data and demo

A fresh install starts empty. Settings → **Seed sample data** explicitly installs synthetic records only when local record collections are empty. It preserves existing extension preferences and canvas state. IDs are generated, dates are relative to the current local date, and calculations use the installed records.

The sample includes 12 tasks (four outstanding overdue), 12 calendar events, five meetings, eight notes, six resources, four communications, four issues, 56 usage observations and two releases. Two tomorrow meetings have direct task/resource links and previous meetings. No fabricated voice recordings or completion history are installed.

Try this sequence after seeding:

1. **“Prepare tomorrow’s meeting.”** Choose a meeting when asked; inspect its evidence and edit its agenda.
2. **“Investigate the product usage drop.”** Follow with **“Only mobile usage.”** Inspect dates, coverage, releases and linked work.
3. **“Review overdue work.”** Follow with **“Only blocked items.”** Edit or schedule a pending task, then reload to verify scope and data persistence.

Interpretation and composition require configured model credentials. Deterministic tests use mocked providers; they do not certify live-model accuracy.

The project/client data model was intentionally retired. The first initialization of this storage version removes known old Orlo keys and old local audio before creating empty records. There is no migration. **Reset local data** clears records, notes, attachments/audio, layouts, pins, history, preferences and extension data. Cleanup errors block the app and offer Retry or explicit Reset. OAuth sessions, unrelated origin storage and remote Google Calendar events are preserved.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Generic dashboard and adaptive canvas |
| `/landing` | Landing page |
| `/tasks`, `/notes`, `/meetings`, `/resources`, `/planner` | Shared local records and tools |
| `/plugins` | Enable built-ins and import external plugins |
| `/calendar` | Redirect to Meetings calendar view |
| `/workspace/:mode` | Predefined component previews |
| `/dev/components` | Component gallery |
| `/insights`, `/priorities` | Redirects to dashboard/tasks |

## Run locally

Use Node 22.18+ (Node 24 recommended). In `client/`:

```bash
npm ci
npm run dev
```

Copy `client/.env.example` to `client/.env.local` and configure a model provider/key/model to enable AI generation. Supported transports include OpenAI, Groq, Ollama and a configured gateway. Credentials stay server-side; never use `VITE_*` for API keys. Dedicated local pages work without model credentials.

Production: `npm run build`, then `npm start`. The server serves the SPA and APIs together; `npm run preview` alone does not serve APIs.

## Boundaries

`browserDatabase` is the shared local record store. Domain records use `orlo-data-v2`; version-2 collection envelopes use `orlo-browser-db-v2`. The canonical canvas document is version 3; active intent/composition contracts are version 2. Old active formats are rejected. This is browser-local persistence, with no multi-user authorization, cloud synchronization or backend database yet.

`POST /api/workspace/resolve` routes component requests. `POST /api/intent` resolves meeting/date/segment/owner scope. `POST /api/workspace/compose` arranges validated snapshots with evidence. `POST /api/generate` supports general OpenUI generation. Application services own mutations; generated actions cannot choose arbitrary handlers or override their originating scope.

Google Calendar uses account-qualified bindings and separate authorization. Disconnected accounts show placeholders, never synthetic substitutes. See [Google Calendar setup](GOOGLE_CALENDAR_SETUP_AND_TESTING.md).

## Verification

Run in `client/`:

```bash
npm test
npm run build
npm run lint
npm run test:render
```

Optional browser checks: `npm run test:local-data`, `npm run test:kanban`, `npm run test:extensions`, `npm run test:plugin-import`, and `npm run test:continuity`. They start their own Vite server and use fresh isolated browser storage. Supply `ORLO_PLAYWRIGHT_MODULE` and optionally `ORLO_CHROME_PATH` when Playwright/Chromium are installed outside the project.

`npm run test:intent:live` is an opt-in provider evaluation. A complete live three-goal demonstration, comprehensive accessibility audit and physical microphone/mobile-browser checks remain separate acceptance work. Existing production bundle-size and lint warnings remain.

See [PLAN.md](PLAN.md) and [services documentation](client/src/services/README.md). External plugin packaging is described in [examples/plugins/README.md](examples/plugins/README.md).
