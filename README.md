# GoGPT — Adaptive Productivity Workspace

HackWave 3.0 · PS 4: Human-Centered AI / Intent-to-Interface

**Describe your goal. GoGPT arranges the relevant information, editable tools, and next actions around it.**

GoGPT is a generalized workspace for students, teachers, freelancers, and professionals. It uses one reusable component library and one workspace surface at **`/app`**. Eventually, changing goals will change the composition while preserving drafts, context, filters, and pinned components.

## What we build first

Build a complete **static frontend prototype** with React + TypeScript + Vite. Start `/app` with a generic dashboard, then show predefined planning, scheduling, preparation, and overdue-work layouts on the same canvas.

Static means deterministic demo data and predefined configurations. Controls can update shared in-memory React state: complete a task, edit an agenda, select a slot, filter records, or switch previews. Display **“Demo data; changes reset on reload.”** The command bar is labeled **“AI not connected.”**

Later, intent resolution and AI planning supply validated configurations to the same renderer. Reuse the components rather than rebuild the frontend for each profession or goal.

## Current status

- [x] React + TypeScript + Vite client initialized.
- [x] Initial “Coming Soon” landing page and concept documentation present.
- [x] Local architecture reference inspected; staged roadmap recorded in [PLAN.md](./PLAN.md).
- [ ] `/app` routing and application shell implemented.
- [ ] Reusable component library and static workspace previews implemented.
- [ ] Backend, persistence, authentication, integrations, and AI implemented.

These checkboxes describe implementation status. The initial client has passed build and lint checks; the planned application has not yet been built.

## Routes and reuse

| Surface | Purpose |
| --- | --- |
| `/` | Landing page and entry into the workspace |
| `/app` | Generic dashboard by default; one shared workspace rendering surface |
| `/app?view=tasks`, `calendar`, `meetings`, `planner`, `priorities`, `insights`, `workspace` | Eight views including the default Overview, inside the same shell |
| `/dev/components` | Development-only component/state gallery |

Student, Teacher, and Professional role packs provide context, suggestions, and presets. They are context choices, not separate applications or authorization roles.

## Technology

| Layer | Current or planned |
| --- | --- |
| Foundation | React 19, TypeScript, Vite, npm — configured |
| Styling/primitives | Tailwind CSS + shadcn/ui — planned |
| Icons/charts | Lucide React + Recharts — planned |
| Navigation/dates | React Router + date-fns — planned |
| Transitions | Motion for React with reduced-motion support — planned |
| Session state | React Context + reducer and selectors — planned |
| AI rendering | OpenUI adapters evaluated in Stage 3; no AI packages required in Stage 1 |
| Backend/database | Separate API and persistence selected in Stage 2 |

Keep React + Vite. The reference uses Next.js, but GoGPT does not adopt its framework or travel features.

## Stages and checklist

### Stage 0 — Baseline and architecture

- [x] Inspect the client and local `open-intelligent-ui/` reference.
- [x] Document the `/app` strategy, reuse, and data/state boundaries.
- [x] Establish [PLAN.md](./PLAN.md) as the authoritative roadmap.

### Stage 1 — Static frontend

- [ ] Establish theme tokens, accessible primitives, responsive shell, and routing.
- [ ] Create normalized deterministic fixtures with one demo clock/timezone.
- [ ] Build all 18 core components plus resource, outline, context, and evidence widgets.
- [ ] Assemble eight views from shared widgets, selectors, and state.
- [ ] Add daily-planning, meeting-scheduling, and overdue-recovery presets.
- [ ] Add student exam, teacher lesson, professional meeting, and usage-analysis examples.
- [ ] Preserve local edits, drafts, filters, and pins when compositions change.
- [ ] Provide static explanations, meaningful local actions, undo/reset, and a state gallery.
- [ ] Verify light/dark themes, responsive behavior, accessibility, build, and lint.

**Exit:** complete session-only frontend. No model calls, backend, authentication, database, or external integrations.

### Stage 2 — Functional data and persistence

- [ ] Introduce a separate server API behind the existing repository boundary.
- [ ] Persist tasks, events, drafts, resources, and workspace preferences.
- [ ] Validate create/edit/schedule operations and handle conflicts.
- [ ] Add authentication and ownership checks before real/shared data.
- [ ] Verify reload restoration and agreement across views.

**Exit:** working productivity features using the same `/app` and components.

### Stage 3 — Intent-driven adaptive workspace

- [ ] Resolve goals, entities, dates, and ambiguity from natural language.
- [ ] Retrieve relevant records and select approved components/actions.
- [ ] Validate layout plans and render through the existing registry.
- [ ] Evaluate OpenUI with thin adapters around existing widgets.
- [ ] Preserve edits/pins and keep the last valid layout on failure.
- [ ] Explain selections with evidence and support follow-up adaptation.

**Exit:** genuine goal-driven adaptation; static previews are no longer the only layout source.

### Stage 4 — Integrations, evaluation, and deployment

- [ ] Select calendar/document/LMS or project-tool integrations from user needs.
- [ ] Handle sync failures, timezones, permissions, and reviewed external writes.
- [ ] Evaluate paraphrases, ambiguity, task completion, and state preservation.
- [ ] Deploy the Vite SPA with `/app` fallback routing and the server API.
- [ ] Complete the PS 4 demo and document limitations.

Accessibility and relevant checks run throughout development.

## PS 4 demonstration

Start with the generic `/app` dashboard. Show client meeting preparation, product-usage investigation, and overdue project review reorganizing that same canvas. Student and teacher presets demonstrate generality.

Perform one meaningful action per composition. Narrow context in a follow-up while retaining a pinned widget. Return to an earlier goal with its edited draft intact. Include ambiguity handling and source-backed explanations.

Stage 1 demonstrates **static composition only**. Final PS 4 compliance requires Stage 3 intent understanding, clarification, and real adaptation.

## Local setup

Use **Node.js 24** and npm. The locked Vite toolchain requires Node `^20.19.0 || >=22.12.0`; the previous Node 18 recommendation was insufficient.

```bash
cd client
npm ci
npm run dev
```

Checks, run inside `client/`:

```bash
npm run build
npm run lint
npm run preview
```

`/app` is planned; the current client renders the initial landing page.

## Documentation

- [PLAN.md](./PLAN.md) — architecture, ordered steps, checklists, acceptance criteria, and risks.
- [PROJECT_UNDERSTANDING.md](./PROJECT_UNDERSTANDING.md) — original problem analysis.
- [PHASE_1_IMPLEMENTATION_PLAN.md](./PHASE_1_IMPLEMENTATION_PLAN.md) — earlier UI inventory; PLAN.md takes precedence where scope, routing, state, or sequencing differs.
- [Open Intelligent UI](https://github.com/thesysdev/open-intelligent-ui) — architecture reference, available locally as `open-intelligent-ui/`; not the GoGPT runtime.

Team Harsh231075 · HackWave 3.0
