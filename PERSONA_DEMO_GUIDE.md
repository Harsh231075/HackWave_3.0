# GoGPT — Persona-Based Demo & Multi-Turn Testing Guide

This guide provides end-to-end user workflows and verbatim prompts for **judge panel demonstrations**, **mentoring rounds**, and **automated multi-turn testing**.

Instead of showcasing static components, these scenarios prove how GoGPT functions as an **Intent-Driven Adaptive Workspace** that dynamically synthesizes its layout, embeds specialized productivity widgets, and generates interactive web controls based on evolving user intent.

---

## 🏆 Core Value Proposition for Hackathon Judges

| Traditional Productivity Tools | GoGPT Intent-Driven Workspace |
|---|---|
| **Rigid Layouts:** Users are forced into predetermined dashboards and tabs. | **Generative UI on Demand:** The layout, cards, and widgets reconfigure in ~1.5s based on natural language. |
| **Siloed Context:** Tasks, calendar, notes, and metrics live in separate apps or isolated views. | **Unified Adaptive Canvas:** Combines task boards, calendars, document outlines, and custom forms into a single OpenUI AST. |
| **Chat Disconnect:** Traditional chatbots only output markdown text or prose. | **Functional Interactive Web Controls:** Synthesizes actionable components (`Form`, `Input`, `Select`, `Button`) with live click handlers and client validation. |
| **State Loss on Reconfiguration:** Changing dashboard views often loses in-flight work. | **State Continuity:** Underneath the generative layout, real workspace records (tasks, events, drafts, pins) remain reactive and preserved. |

---

## 🎭 Persona 1: The University Student & Researcher (Rhea)

> **Context:** It is Monday morning (`October 12, 2026`). Rhea has a high-stakes **Statistics exam tomorrow**, a pending **group research proposal**, and limited focus blocks between classes.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Turn 1: Morning Triage     ➔ Turn 2: Deep Study Mode  ➔ Turn 3: Quiz   │
│ (Metrics + Tasks + Cal)       (Outline Notes + Docs)     (Dynamic Form)│
└────────────────────────────────────────────────────────────────────────┘
```

### Turn 1: Morning Triage & Availability
* **User Intent:** Identify overdue coursework, pending high-priority items, and see calendar availability for today.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  I have a Statistics exam tomorrow and my research proposal due. Prioritize my pending tasks and show my calendar availability.
  ```
* **Dynamic UI Behavior:**
  * Generates a `CardHeader` (*"Exam Day & Proposal — Priority Plan"*) and a warning callout.
  * Mounts `WorkspaceWidget("metrics", "full")` summarizing open tasks and focus hours.
  * Mounts `WorkspaceWidget("tasks", "full")` and `WorkspaceWidget("availability", "wide")` showing gaps between scheduled classes.
* **Live Action for Judges:**
  * Click the **Kanban / List** toggle inside the Tasks widget.
  * Check off a completed research item. Note that the metrics react immediately.

---

### Turn 2: Active Study Mode with Notes & Resources
* **User Intent:** Transition from triage into study mode without losing the active task list.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Keep my tasks and calendar, but switch to study mode: add the outline notes widget and linked study resources for Statistics.
  ```
* **Dynamic UI Behavior:**
  * The canvas reorganizes without a page reload.
  * Mounts `WorkspaceWidget("outline", "wide")` (editable study draft) alongside `WorkspaceWidget("resources", "narrow")` containing research and study reference materials.
* **Live Action for Judges:**
  * Type notes directly in the **Outline** editor (e.g. `1. P-values & confidence intervals, 2. Hypothesis testing, 3. Regression`).
  * Open a reference in the **Resources** list.
  * *Judge talking point:* *"Notice how our underlying shared state is completely preserved while the layout reorganized around her new intent."*

---

### Turn 3: Interactive Knowledge Check (Generative Micro-UI)
* **User Intent:** Test recall with a quick self-assessment quiz before diving into readings.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Generate a quick 3-question self-assessment quiz form on research methodology with select options and a submit button.
  ```
* **Dynamic UI Behavior:**
  * Synthesizes an interactive OpenUI `Form` containing `FormControl`s (Select dropdowns and text inputs) and a `Button("Submit Quiz", Action(...), "primary")`.
* **Live Action for Judges:**
  * Pick answers from the dropdowns and click the submit button.
  * *Judge talking point:* *"Instead of a static chat response, our AI generates functional, accessible web controls that the user can immediately interact with."*

---

## 💼 Persona 2: The Startup Tech Lead & Product Specialist (Maya)

> **Context:** Maya leads **Project Northstar**. A mobile release recently triggered an unexpected drop in user sessions, an identity-provider blocker is pending with Alex, and a cross-functional sync is scheduled for 11:30 AM.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Turn 1: Health Audit       ➔ Turn 2: Meeting Prep     ➔ Turn 3: Action │
│ (Metrics + Usage + Tasks)     (Agenda + Evidence)        Item Capture  │
└────────────────────────────────────────────────────────────────────────┘
```

### Turn 1: Project Health Audit & Incident Triage
* **User Intent:** Review Northstar's operational health, blocked items, and today’s schedule.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Audit my Northstar project status: show my urgent blockers, usage metrics drop, and today's meetings schedule.
  ```
* **Dynamic UI Behavior:**
  * Mounts `WorkspaceWidget("metrics", "full")` highlighting blocked items.
  * Mounts `WorkspaceWidget("usage", "wide")` (comparing mobile vs. desktop session drop).
  * Mounts `WorkspaceWidget("meetings", "narrow")` and `WorkspaceWidget("tasks", "full")`.
* **Live Action for Judges:**
  * Click on the **Usage** widget to inspect the release timing observation.
  * Highlight Alex's identity-provider blocker in the task list.

---

### Turn 2: Client Meeting Preparation
* **User Intent:** Prepare for the 11:30 AM client sync with agenda and evidence in reach.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  I have a client check-in at 11:30. Build a meeting prep workspace with an editable agenda outline and relevant evidence documents.
  ```
* **Dynamic UI Behavior:**
  * The canvas declutters: mounts `WorkspaceWidget("outline", "wide")` (pre-filled with agenda points: *1. Clarify goal, 2. Identify blockers, 3. Agree next steps*) and `WorkspaceWidget("resources", "narrow")` (meeting notes & mobile release evidence).
* **Live Action for Judges:**
  * Add a 4th bullet to the live outline draft (*"4. Alex to update IdP config"*).
  * Show that this draft is preserved across reconfigurations and device storage.

---

### Turn 3: Action Item Capture Form
* **User Intent:** Record structured meeting minutes and assign owners on the fly.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Add a structured meeting note-taking form with title, category selection, and an action button to capture minutes.
  ```
* **Dynamic UI Behavior:**
  * Synthesizes an OpenUI `Form` containing a Title `Input`, Category `Select` (*Client, Internal, Blocker*), and a `Button("Save Notes", ..., "primary")`.
* **Live Action for Judges:**
  * Type meeting minutes into the generated form and click **Save Notes**.

---

## ⚡ Persona 3: The Overwhelmed Operations Director (Jordan)

> **Context:** Jordan is dealing with overdue launch deliverables across multiple owners, calendar fragmentation, and cognitive fatigue.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Turn 1: Overdue Recovery   ➔ Turn 2: Focus Protect    ➔ Turn 3: Team   │
│ (Recommendations + Tasks)     (Calendar + Free Slots)    Wrap-up Form  │
└────────────────────────────────────────────────────────────────────────┘
```

### Turn 1: Overdue Recovery Plan
* **User Intent:** Cut through the noise and surface only what is overdue or blocked.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  I am overwhelmed by overdue items. Help me recover: show my overdue blockers, recommendations, and today's timeline.
  ```
* **Dynamic UI Behavior:**
  * Mounts `WorkspaceWidget("recommendation", "full")` giving smart recovery guidance based on earliest outstanding items.
  * Mounts `WorkspaceWidget("tasks", "wide")` and `WorkspaceWidget("timeline", "narrow")`.
* **Live Action for Judges:**
  * Complete an overdue task directly from the widget. Notice how the metrics and recommendation update reactively.

---

### Turn 2: Focus Time Reservation
* **User Goal:** Protect deep work time on the calendar without schedule conflicts.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Show my full calendar and availability so I can block out 90 minutes of protected focus time.
  ```
* **Dynamic UI Behavior:**
  * Mounts `WorkspaceWidget("calendar", "full")` and `WorkspaceWidget("availability", "narrow")`.
* **Live Action for Judges:**
  * Create or reschedule a focus event in the calendar widget. Show undo/redo functionality if an event is deleted.

---

### Turn 3: End-of-Day Delegation Form
* **User Goal:** Summarize decisions and broadcast an update to the team.
* **Prompt to Paste (<kbd>⌘ Cmd + K</kbd> / <kbd>Ctrl + K</kbd>):**
  ```text
  Add a daily wrap-up form with task status summary and an action button to share with the team.
  ```
* **Dynamic UI Behavior:**
  * Embeds an OpenUI delegation form directly below the calendar.

---

## ⏱️ 3-Minute Hackathon Demo Script (Cue Card)

| Elapsed | Script / Action | Key Judge Takeaway |
|---|---|---|
| **0:00 – 0:30** | *"Most productivity tools force users into rigid dashboards. Let's look at Rhea, a student with an exam tomorrow."* <br>👉 Press <kbd>Cmd+K</kbd> ➔ Submit **Persona 1, Turn 1**. | **Intent-Driven Architecture:** Layout generated in ~1.5s based on real cognitive intent. |
| **0:30 – 1:15** | *"Notice she gets her schedule and tasks. She clicks a task to complete it. Now she says: 'Switch to study mode with notes and resources.'"* <br>👉 Press <kbd>Cmd+K</kbd> ➔ Submit **Persona 1, Turn 2**. | **Adaptive State Continuity:** Canvas transforms dynamically, but tasks, notes, and events remain intact. |
| **1:15 – 2:00** | *"Rhea wants to test her knowledge. She asks for a quiz."* <br>👉 Press <kbd>Cmd+K</kbd> ➔ Submit **Persona 1, Turn 3**. | **Generative Micro-UIs:** AI generates live, interactive web components (forms, select menus, buttons). |
| **2:00 – 2:40** | *"Now watch Maya, a tech lead, audit an incident and prepare for an 11:30 client meeting."* <br>👉 Press <kbd>Cmd+K</kbd> ➔ Submit **Persona 2, Turn 1**. | **Cross-Persona Versatility:** Works equally well for engineering leads, students, or executives. |
| **2:40 – 3:00** | *"Everything runs on OpenUI Lang DSL with local AST validation, auto-repair, and instant recovery. No hardcoded layouts."* | **Technical Rigor & Innovation.** |

---

## 🛠️ Live Demo Checklist & Best Practices

1. **Browser Hotkeys:**
   * Press **<kbd>⌘ Cmd + K</kbd>** (Mac) or **<kbd>Ctrl + K</kbd>** (Windows/Linux) to trigger the goal bar.
   * Press **Enter** to submit; press **Escape** to dismiss.
2. **Layout Reset:**
   * Click the `...` menu in the top navigation bar and select **Reset layout** at any time to return to the clean home dashboard.
3. **Groq Free-Tier Rate Limits:**
   * In automated scripts, Groq has a rate limit cooldown window (~5–10s). During a human demonstration, natural pauses while speaking to judges are more than enough to stay within the rate limit.
4. **Offline / Fallback Resilience:**
   * In the rare event of a malformed LLM response, the client's `repairOpenUI` pipeline automatically sanitizes the syntax, and the previous canvas remains safely interactive without crashing.
