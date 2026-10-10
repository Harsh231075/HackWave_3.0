# Build Orlo Around Goals Across Professions

**Keep React, TypeScript, and Vite, but improve Orlo from a collection of productivity pages into a shared workspace that supports different professions through configurable role packs.** Your Phase 1 prompt is strong on visual coverage and reusable components; it is weaker on teaching and studying workflows, meaningful interactions, and preservation of work when layouts change. Build a generalized engine, then validate it with one initial audience rather than promising equal depth for every profession immediately. University students managing coursework and group projects are a practical starting recommendation, with teacher and professional examples demonstrating extensibility. The competitive field already includes automatic planning, contextual agents, and prompt-generated dashboards: **Taskade and ClickUp deserve particularly close comparison**, alongside Motion, Notion, and education specialists. Your differentiation should be tested around useful same-canvas adaptation, understandable explanations, and preserved user work. This review reflects official-source research checked October 10, 2026; it is a selected competitor snapshot, not an exhaustive market survey or runtime-tested product comparison. It assesses your supplied specification and makes no code changes.

## Generalize the engine while making each profession useful

The current specification already serves common activities: tasks, meetings, priorities, calendars, and time blocks. Those are valuable primitives, but they do not make the product meaningfully useful to teachers or students by themselves. Teachers are absent from the target-user list, and most example compositions describe office productivity. A teacher preparing tomorrow’s class needs a lesson outline, learning objectives, resources, and preparation checklist. A student preparing for an exam needs topics, study materials, exam dates, and revision sessions. Renaming “meeting” to “class” leaves those needs unresolved.

Use the positioning **“Describe your goal; get an editable workspace with the information and actions you need.”** It communicates the intended interaction more precisely than “AI-powered productivity.” Keep one application shell and one workspace engine. Add role packs that configure terminology, suggested goals, optional components, example data, and future data adapters. Let users choose their context explicitly and switch it: a student can freelance, a teacher can study, and a professional can manage a personal project. The current goal and selected context should determine the interface; a profession label should not restrict what people can do.

Create shared records for Person, Workspace, Project/Course, Goal, Task, Event/Session, Resource, Note/Draft, and Activity. Give each record stable identifiers, ownership/scope, timestamps, source references, and links to related records. Courses, classes, clients, and projects can specialize the context without filling a single Task type with every profession’s fields. This is an architectural recommendation rather than an existing repository capability.

| Role pack | Useful goal | Main components | Meaningful prototype action |
|---|---|---|---|
| Student | Plan a deadline-heavy week | Deadline list, weekly timeline, workload summary, study resources | Move a study block and complete a task |
| Student | Prepare for an exam | Topic checklist, resource list, revision plan, editable outline | Save a revision outline and mark topics reviewed |
| Student | Recover overdue group-project work | Task queue, blockers, owners, recovery recommendations | Filter by owner and change a task priority |
| Teacher | Prepare next week’s lessons | Teaching calendar, lesson outline, resource list, preparation checklist | Edit and save a lesson outline |
| Teacher | Organize pending feedback | Review queue, rubric/resource references, deadlines | Select a review item and update its local status |
| Professional | Prepare a meeting or recover work | Meeting brief, agenda, tasks, communications/resources | Save an agenda or reschedule a task |

**Start with three student workflows and one teacher preview**, while retaining a professional sample to show reuse. This is a recommendation for manageable implementation and validation, not evidence that students have the highest willingness to pay. Before expansion, observe whether users finish these tasks faster and return to the workspace. Do not infer demand from the availability of AI components.

Add ResourceList, ContextSummary, EditableOutline/Checklist, and Evidence/SourceLink to the shared vocabulary. These components allow preparation work to produce an editable artifact supported by inspectable materials. Replace a vague productivity score with transparent measures relevant to the goal: remaining deadlines, planned versus available time, review items remaining, study topics reviewed, or preparation checklist completion. Time logged does not establish learning, and a task-completion count should not imply a judgment of personal worth.

## Make Phase 1 prove composition and continuity

Your prompt’s eight pages and eighteen components provide useful coverage, but **screen count does not prove an adaptive product**. Give the Workspace primary navigation prominence and treat Tasks, Calendar, Meetings, and Insights as supporting tools. Keep navigation, context selection, and user controls stable while the central canvas changes its working hierarchy. Daily planning should promote the timeline; exam preparation should promote resources and an outline; overdue recovery should promote blockers and the work queue. Changing card colors or loading a separate page for each goal would be weak evidence of composition.

Move shared local application state into Phase 1. This does not require a backend, database, or authentication. One normalized fixture dataset and local React state can ensure that completing a task updates every related view, a saved agenda remains visible after a preview switch, and selected time slots agree with the calendar. Display **“Demo data; changes reset on reload.”** A Save action should update the session’s draft. A unavailable integration action should be visibly disabled with a short explanation. Success feedback should follow an actual local change.

Use a typed, predefined WorkspaceConfig containing a schema version, current goal, context/entity identifiers, layout kind, widget instances, data references, explanation references, and allowed actions. Register components with typed props, data selectors, permitted sizes, and action handlers. Start with a small layout vocabulary such as overview, planning, analysis/review, and work queue. This gives future model output a constrained contract to validate; arbitrary generated JSX or executable styling is unnecessary.

Give each widget a short, static “Why shown?” explanation linked to relevant mock records. For example, “Shown because this assignment is due before your next available study session.” The global ExplanationPanel should describe the current preview’s purpose and changed priorities. Label these explanations as examples during Phase 1. Pinning, reset, and undo should let users control the composition, while draft text and task state survive layout switches.

Retain the Phase 1 restriction on AI integration. The command bar should say **“AI not connected — preview layouts below”**, and the development selector should explicitly switch static previews. Do not make arbitrary text appear to cause AI adaptation. Phase 1 establishes the component and interaction foundation; it cannot satisfy PS 4’s actual intent understanding, clarification, and prompt-driven adaptation requirements.

The prompt also needs a coherent demo date and timezone. A clearly labeled fixed demo week makes screenshots and overdue classifications reproducible. Calendars should accommodate overlapping events, crowded days, long titles, and a mobile agenda. Keep focus on stable controls during layout changes, announce the active preview, respect reduced motion, provide chart text summaries, and use labels alongside status colors. Accessibility and interaction verification should begin now rather than waiting for deployment.

## Existing products already cover much of generic AI productivity

The closest comparison depends on which promise Orlo emphasizes. Motion and Reclaim optimize schedules; Notion, ClickUp, and Microsoft combine context with AI-assisted work; Taskade generates apps and workflows; education specialists handle teaching and learning. These categories describe documented capabilities, not an independent ranking of product quality.

| Product | Current documented overlap | Implication for Orlo |
|---|---|---|
| Taskade | Prompts create live apps, dashboards, agents, and workflows backed by workspace data | Compare composition and usable actions directly; it is a near-direct competitor ([Taskade](https://www.taskade.com/)) |
| ClickUp Brain | Interactive/shareable dashboards, slides and prototypes from work data; persistent preferences and workflows from prompts | Do not claim competitors only generate text; measure continuity and task usefulness ([ClickUp documentation](https://help.clickup.com/hc/en-us/articles/12578085238039-What-is-ClickUp-Brain-AI)) |
| Motion | Schedules tasks around priorities, deadlines, and dependencies, then reoptimizes the day | Daily planning and overdue recovery need more than a calendar UI ([Motion task manager](https://www.usemotion.com/features/ai-task-manager)) |
| Reclaim | Calendar chat, focus/habit/meeting agents, integrations, insights, and staged changes in Preview Mode | User-controlled scheduling changes already have established examples ([Reclaim documentation](https://help.reclaim.ai/en/articles/14846468-how-to-get-started-with-reclaim)) |
| Notion Agents | Uses workspace context and connected tools for personal and recurring team workflows | Source-backed preparation and retained context face strong competition ([Notion Agents](https://www.notion.com/product/agents)) |
| Microsoft 365 Copilot | Agents include Analyst, Researcher, Visual Creator, and Learning Coach | Professional and student workflows overlap; availability depends on subscription and administration ([Microsoft documentation](https://support.microsoft.com/en-us/microsoft-365-copilot/agents-built-by-microsoft)) |
| MagicSchool | Teacher lesson plans, worksheets, quizzes, rubrics; student research, feedback, and guided assistance | Teacher/student value needs domain-specific interactions ([MagicSchool tools](https://www.magicschool.ai/magic-tools)) |
| Khanmigo | Teaching assistance and guided tutoring, including preparation tools | Adjacent competitor when Orlo expands beyond planning into learning ([Khanmigo](https://www.khanmigo.ai/)) |

**“AI command bar plus tasks and charts” is insufficient differentiation.** Taskade and ClickUp already make generating interactive work surfaces a competitive area. The sources do not establish whether every competitor continuously reorganizes an existing canvas while preserving all unsaved work. Therefore, “we are the first adaptive UI” or “nobody preserves context” would be unsupported. Treat explainable same-canvas adaptation with preserved drafts, filters, and pinned context as a product hypothesis to demonstrate and compare.

For a future head-to-head evaluation, use the same task and starting records: ask users to prepare an exam plan, then recover overdue work, then return to their edited plan. Measure successful completion, corrections needed, retained work, and whether explanations help users understand the changes. This evaluates the proposed advantage more directly than feature counts. Pricing, revenue, adoption, market size, and customer satisfaction were not researched here, so this report does not establish commercial viability or a pricing recommendation.

## YC companies show both direct competition and specialized opportunities

The verified YC examples span mature productivity competitors and newer adjacent products. **Motion and Taskade are direct comparisons; Gumloop, Studdy, Frizzle, and Nessie provide adjacent lessons.** Batch affiliations below come from official YC company profiles. Their descriptions reflect current source positioning and should not be confused with launch-day scope.

| Company | Verified YC batch | What it is building | Relationship to Orlo |
|---|---|---|---|
| Motion | Winter 2020 | Work management spanning projects, tasks, calendar, documents, notes, reports, and AI workflows | Direct planning/productivity competitor ([YC](https://www.ycombinator.com/companies/motion), [product](https://www.usemotion.com/)) |
| Taskade | Summer 2019 | Prompt-created apps, dashboards, agents, and automated workflows | Direct/near-direct interface and workflow competitor ([YC](https://www.ycombinator.com/companies/taskade), [product](https://www.taskade.com/)) |
| Gumloop | Winter 2024 | Shared AI agent building, company context, connectors, execution, and controls | Adjacent integration/execution platform ([YC](https://www.ycombinator.com/companies/gumloop), [product](https://www.gumloop.com/)) |
| Studdy | Summer 2023 | Multilingual tutoring using text, speech, and images, with explanations and practice support | Adjacent student learning product ([YC](https://www.ycombinator.com/companies/studdy)) |
| Frizzle | Summer 2025 | Assignment grading, feedback, misconception detection, and instructional dashboards | Adjacent teacher assessment product ([YC](https://www.ycombinator.com/companies/frizzle), [product](https://www.frizzle.com/)) |
| Nessie | Fall 2025 | Shared memory from AI sessions, meetings, notes, and agent traces | Adjacent persistent-context infrastructure ([YC](https://www.ycombinator.com/companies/nessie), [product](https://nessielabs.com/)) |

These companies suggest different product priorities. Taskade makes editable, working outcomes a necessary comparison. Motion makes planning quality more important than attractive scheduling screens. Frizzle illustrates the specificity of teaching workflows; a review queue benefits from supporting evidence and useful feedback actions. Nessie illustrates that context retention is becoming a product category of its own. None of these observations proves an exclusive moat for Orlo.

Studdy’s company-linked website did not fetch during research, so its description here relies on its YC profile. Lindy and Mindgrasp were not verified as YC companies and are excluded from the verified list. The educational company named Flint also had an unresolved profile/name collision in the research; it is excluded rather than assigned an uncertain batch.

## Amend the master prompt before development

Keep the supplied stack and visual direction. Add a section stating: **“Build one generalized workspace engine with explicit Student, Teacher, and Professional role packs. Keep React + TypeScript + Vite. Do not create separate applications per profession. Add shared resource, context-summary, editable-outline/checklist, and source-reference components alongside the existing productivity components.”** This preserves the existing investment while making generalized use concrete.

Replace the showcase instructions with: **“Prioritize three student static previews: deadline-week planning, exam preparation, and overdue group-project recovery. Include a teacher lesson-preparation preview and a professional meeting-preparation preview using the same engine. Preview selection is explicitly static and does not classify natural-language input.”** If all eight pages remain a required deliverable, implement them through shared surfaces rather than duplicating records and behavior.

Add a behavior requirement: **“Use one normalized fixture dataset and shared local React state. Local actions must update relevant views consistently. Switching previews preserves completed tasks, draft text, selected context, and pinned widgets. Provide predictable undo/reset and label session-only changes. Each widget exposes a static, record-grounded relevance explanation.”** This moves the minimum necessary shared state forward without introducing persistence or backend services.

Revise acceptance around outcomes: all preview compositions should change information priority; each needs a meaningful local action; linked records must agree across views; keyboard focus and drafts must survive transitions; narrow-screen calendars need an agenda; component variants must be inspectable in a development gallery. Test relevant loading, empty, and error states without inventing every state for every icon. Report completion as a **Phase 1 static prototype**, not completed PS 4 compliance.

For later phases, build functional persistence and stable data-access interfaces, then real intent/entity resolution, focused clarification, retrieval, validated layout plans, and adaptation. Add authorization before introducing real shared or sensitive data. Integrations and deployment follow, while accessibility and behavior checks continue throughout. The final PS 4 demonstration must accept paraphrases, resolve ambiguity, adapt the same canvas after corrections, and preserve user work with evidence-linked explanations; preset switching alone cannot establish those capabilities.

## Conclusion

The most useful next decision is the first repeatable workflow Orlo will help someone finish, rather than the number of professions it will advertise. A student-focused first release with credible teacher and professional previews can demonstrate generality while keeping the product testable. Interviews and observed sessions should determine whether that initial audience stays the right choice.

Build the continuity contract into Phase 1: what remains when goals change, what users can edit, and why components appear. If those behaviors work before AI arrives, the later model integration can improve selection and composition without forcing a redesign of the application’s core experience.
