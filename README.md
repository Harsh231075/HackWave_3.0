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
- Last valid canvas retained on provider errors, invalid output, cancellation, and unsupported goals.

The meeting workflow is scoped to actual supplied records. Usage investigation and overdue review currently continue through the existing general generation path after intent resolution; their complete scoped workflows remain future work. AI interpretation requires configured model credentials. Automated checks use mocked providers and do not certify live-model accuracy.

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

Tasks/events/drafts persist under the existing workspace key. Additional clients/projects/meetings/communications/issues/relationships/resources use the shared metadata database. Layout version 2 saves meeting scope and composition while continuing to read version-1 responses. Unsaved agenda buffers survive view switches in the current session; only saved drafts survive reload. Pins remain session-only. Layout reset does not reset domain records.

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
