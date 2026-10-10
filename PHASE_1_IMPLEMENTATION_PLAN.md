# Orlo — AI-Powered Adaptive Productivity Workspace
## Phase 1 Implementation Plan & Architecture Blueprint
### HackWave 3.0 • Problem Statement 4: Intent-to-Interface

---

## 1. Executive Summary & Scope Boundaries

### 🎯 Objective
Build a complete, modern, responsive, production-quality static frontend prototype for **Orlo**. This establishes the comprehensive visual, architectural, and component foundation required before integrating AI inference or backend data layers in subsequent phases.

### ⚠️ Strict Phase 1 Boundaries (What is In vs. Out)
| In Scope (Phase 1) | Out of Scope (Deferred to Future Phases) |
| :--- | :--- |
| ✅ Complete SaaS Application Shell (Sidebar, TopNav, Mobile Drawer) | ❌ Real AI API or LLM endpoints (Gemini, OpenAI, etc.) |
| ✅ Visual AI Command Bar with suggested chips & Phase 1 badge | ❌ Autonomous agent runtime or intent classification models |
| ✅ All **18 Reusable Core UI Components** with full states | ❌ Backend server (Express/FastAPI/NestJS) |
| ✅ All **8 Pages/Views** with responsive desktop/tablet/mobile layouts | ❌ Database persistence (MongoDB, PostgreSQL) |
| ✅ **3 Predefined Adaptive Workspace Showcase Modes** | ❌ Real Google/Outlook calendar or email integrations |
| ✅ Interconnected, realistic, deterministic Mock Dataset | ❌ Authentication / User login sessions |
| ✅ Light & Dark theme support, accessible contrast, smooth transitions | ❌ Dynamic runtime JSON layout generation by AI |

---

## 2. Directory Architecture & Module Organization

The frontend codebase inside [`client/`](file:///Users/himanshusingh/Desktop/Hackwave/client) will be organized into modular, self-contained directories adhering to modern React + TypeScript standards:

```text
client/src/
├── assets/                          # Static branding assets, logos, and icons
├── types/                           # Central TypeScript definitions
│   ├── index.ts                     # Barrel export
│   ├── task.ts                      # Task, priority, status, category types
│   ├── meeting.ts                   # Meeting, participant, agenda, slot types
│   ├── schedule.ts                  # TimeBlock, timeline, calendar event types
│   ├── metric.ts                    # KPI card and productivity chart types
│   ├── recommendation.ts            # Explainable recommendation types
│   └── workspace.ts                 # Layout config, component descriptor types
│
├── mock/                            # Interconnected deterministic mock data
│   ├── index.ts                     # Unified mock data store & getters
│   ├── user.ts                      # User profile & preferences
│   ├── tasks.ts                     # Tasks (regular, urgent, overdue, completed)
│   ├── meetings.ts                  # Scheduled meetings & participant profiles
│   ├── calendarEvents.ts            # Synchronized monthly/weekly/daily events
│   ├── schedule.ts                  # Time blocks, availability & busy slots
│   ├── metrics.ts                   # KPI metrics & weekly productivity points
│   ├── recommendations.ts           # Contextual recommendation cards
│   └── workspaceConfigs.ts          # Predefined configurations for Modes A, B, C
│
├── components/                      # All 18 reusable modular UI components
│   ├── layout/                      # Application shell components
│   │   ├── AppShell.tsx             # Responsive layout wrapper with sidebar & topnav
│   │   ├── Sidebar.tsx              # Collapsible sidebar with active route states
│   │   ├── MobileDrawer.tsx         # Mobile navigation drawer
│   │   ├── TopNav.tsx               # Header, breadcrumbs, search, theme toggle, avatar
│   │   └── AiCommandBar.tsx         # Prompt input placeholder + suggested chips
│   │
│   ├── ui/                          # Base primitive widgets & badges
│   │   ├── Badge.tsx                # Status, priority & category badges
│   │   ├── Button.tsx               # Primary, secondary, outline, ghost buttons
│   │   ├── Modal.tsx                # Accessible backdrop & dialog container
│   │   ├── Dropdown.tsx             # Select dropdown & action menus
│   │   └── Skeleton.tsx             # Loading placeholders for cards & charts
│   │
│   ├── metrics/                     # Component 1
│   │   └── MetricCard.tsx           # Title, value, % change, trend icon, skeleton
│   │
│   ├── tasks/                       # Components 2, 3, 4, 5
│   │   ├── TaskCard.tsx             # Card with status, priority, due date, actions
│   │   ├── TaskList.tsx             # Filterable, sortable list with empty state
│   │   ├── PriorityBoard.tsx        # Urgent/High/Med/Low 4-column priority board
│   │   └── TaskForm.tsx             # Creation/edit modal form with validation states
│   │
│   ├── calendar/                    # Components 6, 9
│   │   ├── CalendarView.tsx         # Monthly, Weekly, and Daily views + nav
│   │   └── AvailabilityPanel.tsx    # Available vs busy slot grid + conflict alerts
│   │
│   ├── meetings/                    # Components 7, 8
│   │   ├── MeetingCard.tsx          # Meeting card, participants, status, agenda
│   │   └── MeetingForm.tsx          # Meeting scheduling form modal
│   │
│   ├── planner/                     # Components 10, 11
│   │   ├── DailyTimeline.tsx        # Hourly timeline with meetings, tasks, breaks
│   │   └── TimeBlockCard.tsx        # Activity block, category, time range, status
│   │
│   ├── insights/                    # Component 17
│   │   └── ProductivityChart.tsx    # Recharts: trend, category breakdown, daily hours
│   │
│   ├── feedback/                    # Components 12, 13, 14
│   │   ├── RecommendationCard.tsx   # Actionable advice with reason & severity
│   │   ├── ConfirmationDialog.tsx   # Change preview modal with confirm/cancel
│   │   └── ExplanationPanel.tsx     # "Why this interface?" transparent rationale
│   │
│   └── workspace/                   # Components 15, 16, 18
│       ├── FilterControls.tsx       # Date, priority, category, status filter bar
│       ├── WorkspaceToolbar.tsx     # Mode indicator, pin, refresh, layout controls
│       └── WorkspaceRenderer.tsx    # Layout engine rendering predefined configs
│
├── pages/                           # The 8 full page views
│   ├── OverviewPage.tsx             # Page 1: Dashboard overview
│   ├── TasksPage.tsx                # Page 2: My Tasks management & filters
│   ├── CalendarPage.tsx             # Page 3: Calendar (month/week/day)
│   ├── MeetingsPage.tsx             # Page 4: Meetings & scheduling
│   ├── PlannerPage.tsx              # Page 5: Daily Planner & timeline
│   ├── PrioritiesPage.tsx           # Page 6: Priorities & overdue recovery
│   ├── InsightsPage.tsx             # Page 7: Productivity analytics & charts
│   └── WorkspaceShowcasePage.tsx    # Page 8: Adaptive Workspace Showcase (Modes A/B/C)
│
├── context/                         # Client-side state providers
│   ├── ThemeContext.tsx             # Light/dark mode toggle & system preference
│   └── AppStateContext.tsx          # Local task/meeting selections, filters, mock state
│
├── routes/                          # Navigation routing
│   └── AppRoutes.tsx                # React Router DOM configuration
│
├── App.tsx                          # Root container wrapping context & routes
├── main.tsx                         # React 19 entry point
└── index.css                        # Tailwind CSS imports & theme CSS variables
```

---

## 3. The 18 Reusable Core Components Specification

Every component will be fully implemented, self-contained, typed, and support required states (`default`, `hover`, `active`, `loading`, `empty`, `error` where applicable):

| # | Component | Primary Props & Features | Visual States Supported |
| :- | :--- | :--- | :--- |
| **1** | **MetricCard** | `title`, `value`, `icon`, `changePercent`, `trend ('up'\|'down'\|'neutral')`, `description`, `isLoading` | Default, Loading skeleton, Positive trend, Negative trend |
| **2** | **TaskCard** | `task: Task`, `onToggleComplete`, `onSelect`, `compact?: boolean` | Default, Hover, Completed (strikethrough), Overdue (red alert), Blocked, Urgent badge |
| **3** | **TaskList** | `tasks: Task[]`, `filter`, `sort`, `searchQuery`, `onTaskCreate`, `onTaskToggle` | Populated rows, Empty filter result, Loading state |
| **4** | **PriorityBoard** | `tasksByPriority: Record<Priority, Task[]>`, column counts, task cards | 4 Columns (Urgent, High, Medium, Low), Drag target styling |
| **5** | **TaskForm** | `isOpen`, `onClose`, `onSubmit`, `initialData?: Task` | Clean form, validation errors, duration stepper, priority tags |
| **6** | **CalendarView** | `events: CalendarEvent[]`, `viewMode ('month'\|'week'\|'day')`, `selectedDate`, `onSelectDate` | Month grid, Week time-grid, Day view, Today highlight, Category color dots |
| **7** | **MeetingCard** | `meeting: Meeting`, `onJoinClick`, `onViewDetails` | Upcoming, In-progress (pulsing badge), Completed, Participant avatars |
| **8** | **MeetingForm** | `isOpen`, `onClose`, `onSubmit` | Inputs for title, time range, attendees list, category, agenda notes |
| **9** | **AvailabilityPanel** | `date: Date`, `slots: TimeSlot[]`, `onSelectSlot`, `conflictWarning?: string` | Available (green/indigo), Busy (muted hatch), Selected slot, Conflict banner |
| **10** | **DailyTimeline** | `timeBlocks: TimeBlock[]`, `currentHour: number`, `onBlockClick` | 8 AM - 8 PM scale, Current time red line, Event cards, Free gap blocks |
| **11** | **TimeBlockCard** | `block: TimeBlock`, `onStatusChange` | Focus Work, Meeting, Review, Break categories; progress indicator |
| **12** | **RecommendationCard**| `recommendation: Recommendation`, `onAccept`, `onDismiss` | Severity banner (Critical, Suggested, Optimization), Reason description, Action button |
| **13** | **ConfirmationDialog**| `isOpen`, `title`, `description`, `beforeState`, `afterState`, `onConfirm`, `onCancel` | Warning state, before/after diff preview, confirm/cancel buttons |
| **14** | **ExplanationPanel** | `intent: string`, `purpose: string`, `surfacedComponents: string[]`, `reasons: string[]` | Explainability drawer/card: rationale breakdown, confidence badge |
| **15** | **FilterControls** | `activeFilters`, `onFilterChange`, `onReset`, `searchQuery`, `onSearchChange` | Pill toggles for Priority, Status, Category, Date range picker, Clear button |
| **16** | **WorkspaceToolbar** | `title`, `currentMode`, `onModeSwitch`, `onRefresh`, `onPin`, `showExplanation`, `onToggleExplanation` | Mode badge, Pin button, Layout options, Explanation toggle button |
| **17** | **ProductivityChart** | `data: MetricPoint[]`, `type ('trend'\|'bar'\|'pie'\|'comparison')` | Tooltip hover, responsive container, legend, empty chart state |
| **18** | **WorkspaceRenderer** | `config: WorkspaceConfig`, `componentsMap` | Dynamic grid layout (1, 2, or 3 columns), responsive slot placement |

---

## 4. The 8 Required Pages / Views

### Page 1: Overview Dashboard
- **Header:** Personalized greeting + date + AI Command Bar (with quick suggested prompt chips).
- **Top Metrics Row:** 4 `MetricCard`s (Total Tasks, Completed Today, Overdue Items, Focus Hours).
- **Two-Column Core Canvas:**
  - *Left Column (60%):* Today's Prioritized Tasks (`TaskList`) + Daily Schedule Timeline Preview (`DailyTimeline`).
  - *Right Column (40%):* Upcoming Meetings (`MeetingCard`s) + Actionable AI Recommendation (`RecommendationCard`) + Weekly Productivity Preview (`ProductivityChart`).
- **Footer Section:** Recent activity log stream.

### Page 2: My Tasks
- **Task Summary Header:** Total, Pending, Completed, and Overdue count badges.
- **Action & Filter Bar:** `FilterControls` (search, priority filters, status dropdown, "+ New Task" trigger).
- **Main View Tabs:** List View (`TaskList`) vs. Board View (`PriorityBoard`).
- **Interactive Drawer/Modal:** `TaskForm` modal for creating and inspecting task details.

### Page 3: Calendar
- **Header:** View switch buttons (Month / Week / Day) + Today jump button + Month date navigator.
- **Calendar Grid:** Fully styled monthly grid with event markers (meetings in purple, task deadlines in amber/red).
- **Side Panel (Day Inspector):** Selected date summary showing scheduled meetings and tasks due on that date.

### Page 4: Meetings
- **Header:** Quick stats (Meetings Today, Hours in Calls) + "+ Schedule Meeting" button (`MeetingForm`).
- **Two-Column Scheduling Interface:**
  - *Left Column:* List of upcoming and completed meetings (`MeetingCard`s with agendas and participants).
  - *Right Column:* `AvailabilityPanel` displaying free vs. busy time slots for the selected day + conflict warnings.

### Page 5: Daily Planner
- **Header:** Date navigator + Plan Day status indicator.
- **Main Layout:**
  - *Left Column (Timeline):* Visual `DailyTimeline` mapping 8:00 AM to 8:00 PM with meetings, focus blocks, and breaks.
  - *Right Column (Planning Tools):* Unscheduled tasks queue + `TimeBlockCard` list + Planning recommendations (`RecommendationCard`).

### Page 6: Priorities
- **Urgent Alert Banner:** Highlighting tasks at risk or overdue.
- **Priority Board Canvas:** 4-column `PriorityBoard` (Urgent, High, Medium, Low) with visual priority badges and task cards.
- **Recovery & Rebalance Panel:** Suggested task reschedules and `ConfirmationDialog` preview for batch rescheduling.

### Page 7: Productivity Insights
- **Key Performance KPIs:** Completion rate (84%), Focus efficiency, Avg task duration.
- **Charts Grid:**
  - Task completion trend over last 14 days (Area Chart).
  - Weekly category time allocation (Bar/Donut Chart).
  - Daily productivity score comparison.
- **Insight Callouts:** Summary bullet points on peak productivity hours and bottleneck categories.

### Page 8: Adaptive Workspace Showcase (PS 4 Star Deliverable)
This dedicated showcase visualizes how Orlo adapts its entire interface layout according to distinct user intentions using the `WorkspaceRenderer`:
- **Top Toolbar:** `WorkspaceToolbar` featuring an interactive **Dev Mode Switcher** to test all three configurations:
  1. **Mode A — Daily Planning Workspace:**
     - Surfaces: `DailyTimeline` + `TimeBlockCard` list + Priority `TaskList` + `RecommendationCard`.
  2. **Mode B — Meeting Scheduling Workspace:**
     - Surfaces: `CalendarView` (Weekly) + `AvailabilityPanel` + `MeetingForm` modal trigger + `MeetingCard` list.
  3. **Mode C — Overdue Task Recovery Workspace:**
     - Surfaces: Urgent `MetricCard`s + Overdue `PriorityBoard` + Actionable `TaskList` + Reschedule `RecommendationCard` + `ConfirmationDialog`.
- **Integrated `ExplanationPanel`:** A collapsible side drawer/card explaining in plain language:
  - *"Why this interface? Surfaced components based on intent: [Goal]. Highlighted components: [List], because [Rationale]."*

---

## 5. Interconnected Static Mock Data Architecture

To ensure the prototype feels like a cohesive, real-world application, all sample records will be mutually referenced and deterministic:

```
[User Profile: "Alex Morgan" (Lead Product Engineer)]
       │
       ├─► [Tasks (8 total)]:
       │     • "Finalize HackWave UI Architecture" (Status: Pending, Priority: Urgent, Due: Today 5 PM)
       │     • "Audit Q3 Sprint Overdue Deliverables" (Status: Overdue, Priority: High, Due: Yesterday)
       │     • "Prepare slides for Acme Corp review" (Status: In-Progress, Priority: High, Due: Tomorrow)
       │     • "Refactor Tailwind color tokens" (Status: Completed, Priority: Medium)
       │     ...
       │
       ├─► [Meetings (4 total)]:
       │     • "Executive Sync: Acme Corp" (Today 2:00 PM - 3:00 PM, Attendees: 4, Agenda: Review contract milestones)
       │     • "Design System Huddle" (Today 10:00 AM - 10:45 AM, Attendees: 3)
       │     • "Weekly Sprint Planning" (Tomorrow 11:00 AM)
       │     ...
       │
       ├─► [TimeBlocks (Synchronized with Tasks & Meetings)]:
       │     • 09:00 - 10:00: Deep Work (Finalize HackWave Architecture)
       │     • 10:00 - 10:45: Meeting (Design System Huddle)
       │     • 11:00 - 12:30: Focus Session (Overdue Deliverables Recovery)
       │     • 14:00 - 15:00: Meeting (Acme Corp Executive Sync)
       │     ...
       │
       └─► [Productivity Metrics & Recommendations]:
             • Completion Rate: 84%, Focus Hours: 5.5 hrs, Overdue Count: 2
             • Recommendation: "You have 2 overdue deliverables before the Acme Corp review. Reschedule 2 non-critical items to unlock 90 mins focus."
```

---

## 6. Design System & Visual Polish Strategy

### Styling Foundations (Tailwind CSS + Custom CSS Variables)
- **Design Inspiration:** Linear + Notion + modern SaaS (subtle borders, 1px lines, clean typography, neutral palette).
- **Color Palette:**
  - *Light Mode:* Background `#F8FAFC` / `#FFFFFF`, Card border `#E2E8F0`, Text `#0F172A`, Subtext `#64748B`.
  - *Dark Mode:* Background `#0B0F19` / `#111827`, Card border `#1F2937`, Text `#F9FAFB`, Subtext `#9CA3AF`.
  - *Primary Accent:* Indigo/Violet (`#6366F1` / `#8B5CF6`).
  - *Status Accents:* Emerald `#10B981` (Completed/Available), Amber `#F59E0B` (In-Progress/Medium), Rose `#F43F5E` (Urgent/Overdue/Busy).
- **Icons:** `lucide-react` for consistent, crisp 18px-20px iconography.
- **Charts:** `recharts` styled with responsive containers, custom tooltip glassmorphism, and matching theme palettes.
- **Transitions:** Smooth subtle tab and modal transitions using standard CSS / lightweight motion.

---

## 7. Phased Implementation Roadmap

```
Step 1: Setup & Dependencies
  ├── Install Tailwind CSS, PostCSS, Autoprefixer, Lucide React, Recharts, React Router DOM, date-fns
  └── Configure tailwind.config.js, index.css theme variables

Step 2: Core Data Types & Mock Data Engine
  ├── Define TypeScript interfaces in client/src/types/
  └── Create comprehensive interconnected mock records in client/src/mock/

Step 3: Application Shell & Navigation
  ├── Implement Sidebar, TopNav, MobileDrawer, AppShell layout
  ├── Implement visual AI Command Bar with suggested chips
  └── Setup React Router with routes for all 8 pages

Step 4: Build All 18 Reusable Core Components
  ├── MetricCard, TaskCard, TaskList, PriorityBoard, TaskForm
  ├── CalendarView, AvailabilityPanel, MeetingCard, MeetingForm
  ├── DailyTimeline, TimeBlockCard, RecommendationCard, ConfirmationDialog
  ├── ExplanationPanel, FilterControls, WorkspaceToolbar, ProductivityChart
  └── WorkspaceRenderer layout container

Step 5: Assemble the 8 Application Pages
  ├── Pages 1-7: Overview, Tasks, Calendar, Meetings, Planner, Priorities, Insights
  └── Page 8: Adaptive Workspace Showcase (Modes A, B, C)

Step 6: Quality Assurance & Build Verification
  ├── Verify responsive behavior across Mobile (375px), Tablet (768px), Desktop (1440px)
  ├── Test Light & Dark theme toggle
  ├── Run `npm run build` (`tsc -b && vite build`) to guarantee 0 TypeScript/ESLint errors
```

---

## 8. Final Acceptance Verification Matrix

| Verification Item | Acceptance Criteria |
| :--- | :--- |
| **All 18 Components Implemented** | Every single listed component exists as an exported, typed React component with realistic mock data. |
| **All 8 Pages Operational** | All routes navigate properly without blank states, missing imports, or console errors. |
| **3 Workspace Showcase Modes** | Mode A (Daily Planning), Mode B (Meeting Scheduling), Mode C (Overdue Recovery) display visibly distinct component structures. |
| **Cohesive Mock Data** | The same meetings and overdue tasks synchronize seamlessly across the Overview, Calendar, Planner, and Priorities views. |
| **AI Command Bar Notice** | Clearly presented as an elegant visual prototype for Phase 1 with suggested prompts. |
| **Zero Backend / AI APIs** | Strictly static frontend prototype adhering to Phase 1 constraints. |
| **Build & Type Safety** | Clean production build with `0` TypeScript errors. |
