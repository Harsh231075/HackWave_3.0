# GoGPT AI audit and testing guide

Audit date: October 10, 2026. This reviews the current source, not only the conceptual documents.

## Verdict

The AI transport is implemented. The root workspace sends a natural-language goal, previous generated UI, current tasks/events/drafts/pins, and OpenUI component state to `/api/generate`. The server constructs a prompt from the registered library, calls the configured model provider, and returns OpenUI text. The client parses that text before replacing the canvas.

This is a real integration path, but live model quality and browser rendering have not been verified in this audit. Provider calls in the automated tests are mocked; no real API key was used or printed.

## Executed checks

| Check | Result |
|---|---|
| `npm test` on installed Node 22.11.0 | Fails before executing cases: unknown `.ts` extension |
| Existing tests with `node --experimental-strip-types --test server/chat.test.ts server/workspace.test.ts` | 5 passed |
| Complete suite with type stripping | 25 passed: 20 new audit cases, 1 existing API case, 4 state/scheduling cases |
| `./node_modules/.bin/tsc -b` | Passed |
| `npm run lint` | Passed with Fast Refresh export warnings |
| `npm run build` | Fails in `generate:openui`: CommonJS `react-syntax-highlighter` requires ESM `refractor` on the installed Node version |

The two audit tests named “audit finding” assert current undesirable behavior. Passing them documents the bug; it does not mean that behavior meets the product requirements.

## Findings, ordered by impact

### 1. Startup/build tooling currently blocks the standard development command

`package.json` runs `generate:openui` before both `dev` and `build`. That generator SSR-imports the React component library, which hits the CommonJS/ESM dependency error above. Separately, this Node version needs `--experimental-strip-types` to run the `.ts` test and production-server entry points.

Fix the dependency/runtime compatibility and make the supported Node version explicit. Until then, use the checked-in generated spec only for a temporary development check; do not treat bypassing generation as build verification.

### 2. AI can choose widgets but cannot bind goal-specific widget settings

`WorkspaceWidget` accepts only `id` and `span`, and renders `<Widget />` without goal-specific props. Therefore “show only overdue tasks”, “show Statistics tasks”, or “show tomorrow’s calendar” cannot reliably update the task filters, resource selection, draft key, or selected date through this schema. Existing widgets read shared state independently.

The generation context also omits current task filters, selected calendar date, and resource contents. Sending tasks to the model does not automatically apply a filter to the actual task widget. Add validated context/filter/date bindings if these workflows are required.

### 3. No deterministic fallback or automatic repair

Missing credentials/model names produce 503. Provider 401/429/500 and network failures return errors. Invalid OpenUI is rejected on the client and keeps the previous canvas, but there is no repair attempt or local intent router. This does not meet the documented offline/keyless fallback stage.

### 4. Multi-turn support is partial

The request includes previous UI and current records, which supports layout refinement. It does not retain the preceding user goal/conversation history. A clarification referring to information absent from the previous UI may lose context.

Generated form actions only open the goal dialog; they do not directly submit the selected answer or run a domain action. Tasks, events, and saved drafts persist in localStorage. Generated layout, OpenUI component state, pins, filters, selected date, and unsaved draft buffers are not all persisted across a reload. Navigating away from `/` unmounts `DynamicWorkspace` and resets its generated layout on return.

### 5. Duplicate widget policy is primarily a prompt instruction

The static `configSchema` checks uniqueness, but the dynamic OpenUI path does not call it. `Workspace.children` permits an array of references and does not enforce globally unique widget IDs. Multiple workspaces can also repeat the same widget. Add explicit validation to the parsed dynamic tree for duplicate IDs and allowed structure.

### 6. Explainability is generic rather than enforced per goal

Widget frames expose registry reasons. There is no required goal-specific rationale field or validation that the model explains why each widget was selected. A valid response may contain no goal-specific explanation.

### 7. Development and production load environment files differently

Vite uses `loadEnv` and reads `.env` as well as `.env.local`. `npm start` explicitly loads only `.env.local` plus inherited process environment. Credentials stored only in `client/.env` can therefore work in development and fail in production.

`client/.env` currently appears as an untracked file and is not ignored by either `.gitignore`. If it contains credentials, keep it out of commits or use the already-ignored `.env.local`. The audit did not read its contents.

### 8. Smaller validation/UX gaps

- JSON `null` returns 502 due to accessing `body.goal`; it should return 400.
- The backend returns malformed/non-OpenUI model text with HTTP 200; validation occurs only in the browser.
- The initial canvas is the static home preset; the goal dialog starts closed rather than showing the documented prompt-first zero state.
- Provider requests can wait up to 120 seconds; this is non-streaming. A timeout currently appears as a generic 502.
- The current registry contains 13 widget IDs, and shared records replace the older persona-based design. The status document needs updating.

## How to test locally

### Configure the selected provider

From the repository root:

```bash
cd client
```

If `.env.local` already exists, edit it; do not overwrite an existing credential file. Otherwise create it based on `.env.example`. For the default Groq path set:

```dotenv
MODEL_PROVIDER=groq
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Use the model supported by your provider account. Keep credentials server-only without a `VITE_` prefix. Restart the server after changing configuration.

### Run automated tests

On the currently installed Node version:

```bash
node --experimental-strip-types --test server/*.test.ts
```

These tests use fake credentials and mocked provider responses; they do not test live model quality. The original chat test opens a localhost server.

### Start the UI

Try the standard command:

```bash
npm run dev
```

If it fails at spec generation with the audited `refractor` error, a temporary check using the already-generated spec is:

```bash
./node_modules/.bin/vite --host 127.0.0.1 --port 5173
```

This bypasses spec generation and is not a production-build fix. If component definitions changed, the cached spec may be stale. The installed Vite may also warn about the old Node version.

Open `http://localhost:5173/`. Press **Cmd+K** on Mac or **Ctrl+K**, type a goal, then press Enter. Open browser DevTools → Network → `generate` to inspect status and response.

### Manual test cases

| Case | Prompt/action | Expected acceptance result | Current risk |
|---|---|---|---|
| Basic generation | “Show my tasks and calendar.” | One task widget and one calendar; structurally different from home | Live model output not yet verified |
| Study preparation | “Help me prepare for my Statistics exam tomorrow.” | Relevant outline, resources, tasks, and study timeline | Goal-specific resource/task/date binding missing |
| Overdue recovery | “Show only overdue tasks and blockers.” | Only matching records with useful actions | Model cannot set widget filters |
| Meeting preparation | “Prepare for my next client meeting.” | Meeting context, editable agenda, relevant tasks/resources | Resources/draft are shared, not goal-specific |
| Follow-up refinement | Generate tasks, then “Add calendar and keep the tasks.” | Calendar added; existing task changes remain | Only previous UI, not full goal history, is sent |
| Unsaved notes continuity | Generate outline; type `AUDIT NOTE` without saving; request another layout; bring outline back | Note retained during layout changes | Buffer exists for session; reload loses unsaved buffer |
| Saved state continuity | Complete a task, save a draft, then reload | Task and saved draft retained | Generated layout itself resets |
| Duplicate prevention | “Show two copies of my tasks.” | Enforced single task widget regardless of output | No dynamic uniqueness check |
| Ambiguous intent | “Help me prepare.” Choose an answer if a form appears | Clarification and answer inform the next layout | Form action only opens the prompt dialog |
| Cancellation | Submit a goal and immediately click Cancel; then submit another | Spinner stops; old response never replaces newer layout | Requires browser/race verification |
| Provider unavailable | Temporarily unset the selected key in `.env.local`, restart, submit | Useful error and unchanged canvas; fallback if implemented | Current behavior is 503, no fallback |
| Navigation continuity | Generate custom layout → Tasks page → Workspace | Return to generated layout if continuity is required | Dynamic layout resets on unmount |
| Explainability | Generate any goal, open component information | Reasons relate to this goal and supplied records | Current reasons are generic registry text |

For “today” or “tomorrow”, compare against `demoDate` sent in the request and the currently selected calendar date; do not assume they match your real date.

### Direct API smoke check

With the dev server running:

```bash
curl -i http://localhost:5173/api/generate \
  -H 'Content-Type: application/json' \
  --data '{"goal":"Show my tasks and calendar","context":{}}'
```

Expect HTTP 200 and a JSON `response` string for working credentials. This minimal request checks transport only; it sends no real workspace records. For a representative check, inspect or replay the browser's request, which includes current records and previous UI. HTTP 200 alone does not prove that the response parses or renders.

An empty goal should return 400:

```bash
curl -i http://localhost:5173/api/generate \
  -H 'Content-Type: application/json' \
  --data '{"goal":""}'
```

Do not use `npm run preview` for AI API testing: the configured middleware is development-only, and preview does not start `server/index.ts`.

## Suggested next implementation order

1. Stabilize startup/build/test commands and environment loading.
2. Add validated widget filters, selected dates, and goal context.
3. Enforce dynamic widget uniqueness and goal-specific explanations.
4. Add fallback/repair handling and tests for invalid model output.
5. Retain goal history and test multi-turn edits, forms, navigation, and reload in a browser.
