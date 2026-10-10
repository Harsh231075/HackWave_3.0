# Orlo — Current Project Status & Next Implementation Stages
**HackWave 3.0 — Problem Statement 4: Intent-to-Interface (Adaptive AI Workspace)**  
*Date: October 2026*

---

## 1. Executive Summary

Traditional productivity tools force users into static dashboards with predefined tabs, navigation trees, and rigid workflows. **Orlo** reverses this paradigm: **the interface adapts dynamically to the user's natural language intent.**

Instead of clicking through tabs to assemble a workflow, the user states what they need to accomplish. The system interprets the intent, selects the appropriate functional components, injects relevant context, and renders a focused, interactive workspace on demand.

---

## 2. Product Niche, Target Users & Supported Tasks

### A. What Niche Are We Building?
**Orlo** is in the **AI-Powered Adaptive Productivity Workspace / Context-Aware Work OS** niche.

Instead of requiring users to juggle 4–5 disconnected productivity tools (e.g., Notion for notes, Trello/Jira for task tracking, Google Calendar for schedules, Clockify for focus timers):
* **One Adaptive Canvas:** A unified interface where the tools themselves morph dynamically based on the current goal.
* **Goal-Oriented, Not Feature-Oriented:** Users never look for "menus" or "settings" — they declare what they want to accomplish, and the workspace configures itself for that specific workflow.

---

### B. Who Uses This System? (Target User Personas)

| User Persona | Real-World Context | What They Need from the Workspace |
|---|---|---|
| 🎓 **University Students & Researchers** | Preparing for exams, thesis writing, lab submissions, study sprints | Study outlines, formula references, focused revision timers, and course task checklists. |
| 🧑‍🏫 **Teachers, Educators & Mentors** | Lesson planning, grading, lecture preparation, student consultations | Curriculum outlines, linked reference docs, student meeting slots, and class timelines. |
| 💼 **Working Professionals & PMs** | Sprint delivery, resolving blockers, 1-on-1s, executive reviews | Priority triage, team blocker timelines, meeting agendas, and deep work protection. |
| 🚀 **Freelancers & Startup Founders** | Juggling multiple projects, client syncs, tight deadlines | Fast daily planning, calendar slot booking, and distraction-free task execution. |

---

### C. Which Tasks Can Users Perform in Orlo?

Users perform diverse workflows by simply typing their intention into the workspace:

#### 1. Exam & Lesson Preparation
* **User Intent:** *"Tomorrow is my statistics exam. Help me prepare."*
* **What the System Does:** Surfaces an **Editable Study Outline** + **Linked Formula Resources** + **Focus Session Blocks** + **Filtered Exam Tasks**.

#### 2. Daily Planning & Time Blocking
* **User Intent:** *"Plan my Monday schedule with 2 hours of deep focus."*
* **What the System Does:** Evaluates the user's calendar, finds open gaps, reserves a **Focus Time Block**, and surfaces high-priority tasks beside the daily timeline.

#### 3. Overdue Recovery & Blocker Triage
* **User Intent:** *"Show my overdue work and what is blocking the team."*
* **What the System Does:** Generates a **Priority Kanban Board** + **Overdue Task Triage Matrix** + **Action Items with Reassignment & Due Date Pickers**.

#### 4. Meeting Coordination & 1-on-1 Preparation
* **User Intent:** *"Schedule a 1-on-1 with Alex and prepare the discussion agenda."*
* **What the System Does:** Surfaces the **Availability Slot Picker** + **Live Calendar Conflicts** + **Shared Agenda / Notes Draft** + **Past Context Summary**.

#### 5. Distraction-Free Deep Focus
* **User Intent:** *"I need to focus on coding without distractions."*
* **What the System Does:** Strips away sidebars and secondary metrics, surfacing only the **Active Task Card** and a **Pomodoro/Sprint Timer**.

#### 6. Workload & Time Analytics
* **User Intent:** *"Review how my time was spent this week."*
* **What the System Does:** Surfaces **Time Allocation Breakdown Charts** and **Completed Task Metrics** without judgmental productivity scoring.

---

## 3. Where We Stand Today (Current State)

### What Is Already Built & Working (100% Complete)

| Layer | Implementation Details | Status |
|---|---|---|
| **Domain Component Library** | 14 production-grade widgets (`TaskList`, `PriorityBoard`, `CalendarView`, `DailyTimeline`, `MeetingList`, `AvailabilityPanel`, `Metrics`, `ProductivityChart`, `EditableOutline`, `ResourceList`, `ContextSummary`, `RecentActivity`, `UsageExplorer`) | ✅ Complete |
| **Atomic UI Kit** | 13 shadcn-compatible components (Button, Dialog, Sheet, Tabs, Input, Card, Badge, Dropdown, Skeleton, etc.) | ✅ Complete |
| **Layout & Render Engine** | `WorkspaceRenderer` grid layout system supporting `full`, `wide`, and `narrow` component spans; OpenUI `@openuidev/react-lang` integration | ✅ Complete |
| **State Management** | `WorkspaceProvider` managing reactive state, local drafts, filter state, pinned widgets, role contexts (`student`, `teacher`, `professional`), and undo history | ✅ Complete |
| **Routing & Shell** | Full SPA routing (`/`, `/:view`, `/landing`, `/dev/components`) with collateral shell (Sidebar, Topbar, Search palette, Theme toggle) | ✅ Complete |
| **Theme & Design System** | Tailwind CSS 4 with custom dark/light theme tokens and Geist Variable typography | ✅ Complete |
| **Backend Integration Skeleton** | Node.js / Vite server middleware with `/api/generate` and OpenUI schema specs (`server/chat.ts`, `server/index.ts`) | ✅ Complete |

---

### The Current Gap (What Is Missing)

While all the visual pieces and components are built, the app currently behaves like a **traditional dashboard**:
1. When entering the app, it still defaults to a pre-baked static layout with sidebars and fixed preset tabs.
2. The AI prompt input is sitting on top of an already-loaded screen rather than being the **starting trigger** that generates the screen.
3. The server endpoint (`/api/generate`) strictly expects an external `OPENAI_API_KEY`. If no key is set or the API is slow, the generation fails with a `503` error or hangs during live evaluation.
4. There is no automated bridge between what the user types in natural language and how the 14 widgets are dynamically selected and composed.

---

## 4. The End-to-End Intent-to-Interface Flow

Here is the exact lifecycle of how user intent translates into an adaptive screen:

```
┌────────────────────────────────────────────────────────┐
│ 1. User Enters Natural Language Intent                 │
│    e.g. "Tomorrow is my statistics exam. Help me prep" │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Intent Detection & Entity Extraction (AI Engine)     │
│    • Intent: EXAM_PREPARATION                          │
│    • Entities: Subject="Statistics", Urgency="High"    │
│    • User Role: Student                                │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Component Selection & Layout Blueprint Assembly     │
│    Chooses exactly the right widgets from registry:    │
│    • Outline (Revision Notes)      → [wide]            │
│    • Focus Timeline (Study Blocks) → [narrow]          │
│    • Filtered Tasks (Exam items)   → [wide]            │
│    • Linked Resources (Formulas)   → [narrow]          │
│    (Irrelevant widgets like sales charts are hidden)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Context & Data Binding                              │
│    Injects active context into selected widgets:       │
│    • Filters task list to "Statistics"                 │
│    • Loads subject outline draft into editor           │
│    • Schedules 90-min focused study block              │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 5. Smooth Animated Canvas Render + Explainability      │
│    • Canvas morphs into the targeted 4-widget layout   │
│    • Explainability Badge: "Why this view?"            │
│      Explains the rationale for each chosen widget     │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ 6. Multi-Turn Evolution (In-Place Refinement)          │
│    User: "Add my calendar to check open slots"         │
│    • Dynamically injects Calendar widget               │
│    • Preserves existing draft notes & checked tasks   │
└────────────────────────────────────────────────────────┘
```

---

## 5. Data & Persistence Strategy (Do We Need a Database?)

### Recommendation: **No Heavy Database (SQL/Mongo) for Hackathon MVP**

| Aspect | Heavy Database (PostgreSQL / MongoDB) | In-Memory + Browser LocalStorage (Current) |
|---|---|---|
| **Latency** | 200–500ms network roundtrips | **0ms instantaneous updates** |
| **Offline / Demo Reliability** | Fails if DB server drops or network lags | **100% crash-proof during judging** |
| **State Preservation** | Requires auth, schemas, migrations | **Persisted via `localStorage` in `WorkspaceProvider`** |
| **Evaluation Focus** | Backend CRUD (standard, not judged) | **Adaptive UI & Intent AI (the core evaluation criteria)** |

**Conclusion:** Using client-side state preservation with local persistence satisfies all criteria for state retention, undo/redo, and interactive editing without introducing deployment fragility during hackathon evaluation.

---

## 6. Next Stages: Actionable Implementation Roadmap

### Stage 1: The Zero-State Intent Prompt Screen (Clean Canvas)
- When opening the workspace, present a distraction-free, modern interface centered around an AI input prompt:
  - Header: *"What do you want to accomplish right now?"*
  - Quick Intent Chips for instant demonstration:
    - 🎯 *Exam Preparation* (Student context)
    - ⚡ *Overdue Recovery & Blockers* (Team/Management context)
    - 📅 *Plan Today's Schedule & Focus* (Professional context)
    - 🤝 *Schedule a 1-on-1 Meeting* (Coordination context)
    - 📊 *Productivity & Usage Analysis* (Analytics context)

### Stage 2: Dual-Engine Intent Router (Hybrid AI)
- **Live LLM Pipeline:** Uses OpenAI / OpenUI when `OPENAI_API_KEY` is provided.
- **Instant Deterministic NLP Fallback:** Analyzes prompt semantics locally using keyword/entity scoring so the application **never fails or shows a 503 error** even without an API key or when offline.
- Generates the valid layout blueprint:
  ```json
  {
    "title": "Statistics Exam Preparation",
    "rationale": "Surfaced your study outline, sprint timeline, and exam checklists based on your preparation goal.",
    "widgets": [
      { "id": "outline", "span": "wide" },
      { "id": "timeline", "span": "narrow" },
      { "id": "tasks", "span": "wide" },
      { "id": "resources", "span": "narrow" }
    ]
  }
  ```

### Stage 3: Explainability HUD ("Why this Interface?")
- Embed an explicit AI Explainability pill directly on the rendered workspace:
  - Explains why each widget was surfaced.
  - Highlights how data was filtered.
  - Meets the HackWave judging requirement: *"Explainability: system explains why components were surfaced."*

### Stage 4: Multi-Turn In-Place Modification
- Allow the user to press `Ctrl + K` or use the command bar to refine the interface:
  - *"Add calendar"* $\rightarrow$ appends the calendar widget to the grid.
  - *"Focus mode"* $\rightarrow$ collapses auxiliary widgets down to just the active task and timer.
  - Retains all state (no page reload, no data wiped).

---

## 7. HackWave 3.0 Evaluation Alignment

| Evaluation Criterion | How Orlo Addresses It |
|---|---|
| **Intent Understanding** | Translates ambiguous natural language into structured component blueprints. |
| **Dynamic Generation** | Composes a tailored interface on the fly from 14 modular components. |
| **Context Awareness** | Role-based data injection (`student`, `teacher`, `professional`) and smart task filtering. |
| **Direct Interactivity** | Every generated widget is interactive (edit outlines, check tasks, book slots), not static text. |
| **State Preservation** | Seamless layout morphing without data loss, with full Undo/Redo support. |
| **Explainability** | Dedicated visual badge explaining the rationale behind every component choice. |
