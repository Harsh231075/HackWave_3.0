# Orlo intent and UI audit

Audited 11 October 2026. **1330 unique user prompts**: 1,265 main corpus cases and 65 held-out natural-language cases. The main corpus intentionally combines aliases, polite wording, filters, pairs of components and workspace operations; it is not 1,265 independent real conversations.

## Assessment

The product can render all registered components, but unrestricted natural-language reliability is **not complete**. The baseline fallback had two unsafe layout-removal bugs, now fixed. Main corpus performance improved to 1,265/1,265, while a separately authored held-out set still misses 30/65 prompts. This gap is evidence that keyword coverage should not be confused with general intent understanding.

AI-first behavior also depends on provider availability. During each rapid 64-request run, only five requests returned AI decisions; 59 received HTTP 429 rate limits and used Keyword. These stress results measure recovery under load, not the AI's semantic accuracy on 64 responses. Paced testing returned 14 AI decisions and two operational fallbacks; all 16 final outcomes passed the selected expectations.

## Results

| Evaluation | Cases | Passed | Failed | AI decisions | Keyword decisions | Unsafe removal cases |
|---|---:|---:|---:|---:|---:|---:|
| Keyword baseline | 1265 | 1234 | 31 | 0 | 1265 | 2 |
| Keyword after fixes | 1265 | 1265 | 0 | 0 | 1265 | 0 |
| Held-out Keyword | 65 | 35 | 30 | 0 | 65 | 0 |
| Live stress baseline | 64 | 63 | 1 | 5 | 59 | 0 |
| Live stress after fixes | 64 | 64 | 0 | 5 | 59 | 0 |
| Paced live AI | 16 | 16 | 0 | 14 | 2 | 0 |

The paced fallbacks were a provider/network fetch failure for Notes and a timeout for Activity. The 18-second interval reduced rate-limit pressure, but did not eliminate network failures. No claim is made that these small samples establish a production-wide accuracy rate.

**Model contract checks:** 14/16 before the contradictory-status fix; 16/16 after it. **Browser mount checks:** 16/16 registered components, zero browser exceptions. These browser checks confirm mounting/visible component containers, not complete manual CRUD coverage or pixel-level visual quality.

## Main corpus coverage

| Category | Cases | Baseline passed | After fixes passed |
|---|---:|---:|---:|
| component-selection | 270 | 249 | 270 |
| resource-creation | 10 | 9 | 10 |
| combined-add | 420 | 416 | 420 |
| task-filters | 192 | 192 | 192 |
| targeted-remove | 60 | 60 | 60 |
| keep-except | 45 | 45 | 45 |
| clear-and-add | 60 | 60 | 60 |
| reorder | 30 | 30 | 30 |
| removal-safety | 60 | 60 | 60 |
| safety-boundaries | 17 | 15 | 17 |
| multilingual | 39 | 36 | 39 |
| workflows | 16 | 16 | 16 |
| ambiguity-unsupported | 14 | 14 | 14 |
| date-binding | 16 | 16 | 16 |
| context-refinement | 16 | 16 | 16 |

Covered components: Tasks, Calendar, Meetings, Timeline, Availability, Suggestions, Notes, Resource Library, Resource Creation, Context, Summary, Progress, Activity, Usage, Communications and Issues.

The harness applies resolved view/management plans to synthetic canonical workspace documents. It checks registered component selection, unsolicited additions, context preservation, remove/keep/clear-add/reorder outcomes, owner/status/priority/date bindings, workflow selection and clarification. Independent Resource Creation instances are separately covered by the module's regression tests.

## Confirmed defects fixed

1. **Text-edit intent removed Notes:** `Remove the word "all" from my notes` could remove the outline component. Text/record mutation requests now clarify instead of becoming destructive layout plans.
2. **Plural record deletion removed Tasks:** `Delete all task records` bypassed the singular record-mutation detector and removed the Tasks widget. Plural/qualified task, meeting, resource and record requests are now protected.
3. **Resource Library confused with Creation:** `Add resources to my current workspace` selected a creation form. Explicit create/new/form wording is now distinguished from adding the library.
4. **Fallback aliases missing:** work items, schedule grid, Summary and Hinglish khali-time requests failed or selected an unrelated component. These audited variations are corrected.
5. **Combined Resources + Metrics lost Metrics:** the fallback suppressed the explicit metric request when resource wording was present. Both requested selections now survive.
6. **Contradictory AI filters accepted:** a pending/blocked request could accept completed/unfiltered bindings. Explicit requested statuses are now checked against effective bindings, including continuation patches; equivalent status representations remain allowed.

The unfinished-task transport fixture was corrected to represent both pending and blocked work. Validation was not weakened to keep an inconsistent fixture green.

## Remaining held-out failures

These failures remain in the Keyword path. They were retained in the report rather than converted into passing fixtures. They do not establish that AI will fail the same prompts; those held-out prompts were not all submitted live.

| Case | Prompt | Observed failure |
|---|---|---|
| H001 | Let me see what needs doing | missing component: tasks |
| H002 | Bring up my work queue | missing component: tasks |
| H005 | Where is my schedule for today? | missing component: calendar; unsolicited component: timeline |
| H007 | What conversations are coming up? | missing component: meetings |
| H008 | Find an opening in my day | missing component: availability; unsolicited component: metrics; unsolicited component: tasks; unsolicited component: timeline; unsolicited component: meetings |
| H009 | When am I free? | missing component: availability |
| H010 | What should I tackle next? | missing component: recommendation |
| H011 | Give me a recommendation for my next task | unsolicited component: tasks |
| H014 | Show my work journal | missing component: outline |
| H016 | Give me a quick status snapshot | missing component: metrics |
| H020 | Show correspondence history | missing component: communications |
| H022 | Open the resource editor to create something new | missing component: resource-create; unsolicited component: resources |
| H024 | Get rid of the tasks widget | missing management decision |
| H025 | Take the task component off my canvas | missing management decision |
| H026 | Drop the calendar card | missing management decision |
| H029 | Leave only my meetings | missing management decision |
| H030 | Keep just the calendar | missing management decision |
| H031 | Hide everything but my tasks | keep-except result incorrect |
| H032 | Clear the workspace except my notes | missing management decision |
| H034 | Start fresh and show my tasks | missing management decision |
| H035 | Replace the whole workspace with a calendar | missing management decision |
| H036 | Show meetings after clearing everything | missing management decision |
| H037 | Clear everything; show resources | missing management decision |
| H038 | Remove all visible widgets and display my issues | clear-and-add result incorrect |
| H057 | Show tasks due next Friday | missing clarification |
| H058 | Show meetings next month | missing clarification |
| H059 | Show tasks due in two days | missing clarification |
| H060 | Show tasks for 10/12/2026 | missing clarification |
| H061 | Move one of the two task panels | missing clarification |
| H063 | Send an email to Alex | missing clarification |

Important failure groups:

- Conversational requests: work queue, status snapshot, an opening in the day, correspondence history.
- Alternative destructive wording: get rid of, take off the canvas, leave only, keep just, start fresh. Some are missed by the fallback; the same literal authorization rules can reject otherwise sensible AI plans.
- Combined commands and punctuation: semicolons, display after removal, and clearing with exception clauses.
- Unresolved dates: next Friday, next month, in two days and ambiguous numeric date formats are not safely resolved/clarified everywhere.
- Unsupported record actions: “Send an email to Alex” can show communication UI without explaining that sending is unsupported.

The corpus only samples Hindi/Hinglish. The measured multilingual score is not a claim of comprehensive language support. Likewise, current results do not cover every pronoun, multiple ambiguous instances, pinned-state variant, browser, device or multi-turn conversation.

## Recommended architecture improvements

1. **Typed semantic plan:** retain AI-first interpretation, with explicit operations, component/instance IDs, bindings, scope, ambiguity and clause intent. The AI plans the UI; trusted application services remain responsible for record writes.
2. **Semantic authorization independent of exact verbs:** authorize removal from a validated affirmative UI-target clause. Keep record/text changes, quotations, negations, conditionals and hypothetical instructions separate. Do not merely disable removal validation or accept every model clear operation.
3. **Confidence-aware fallback:** when a clause or date is unresolved, ask a targeted question. Never silently drop a requested removal, scope, action or filter and announce success.
4. **Provider-aware request control:** deduplicate equivalent pending requests, limit concurrency, track observed token pressure and surface 429/timeouts. Use bounded retry only within the request deadline; long retry delays should offer a retry action instead of freezing the workspace. Any cache must include current workspace revision, date/timezone and catalog identity.
5. **Execution preview for ambiguous destruction:** show affected component names and preserve record data. Explicit unambiguous commands can execute directly; ambiguous “it/that one” should resolve to a target or clarify.
6. **Continuous evaluations:** retain a fixed regression suite, rotate independent held-out prompts and add multi-turn traces. Score AI source availability, semantic correctness, fallback recovery and destructive safety separately.
7. **Cross-page data verification:** separately test that Google-bound workspace cards, sidebar Meetings and Planner use the intended account/date/source. This audit used synthetic local records and mocked calendars; it does not certify real Google sync or live provider mutations.

## Evidence and reproducibility

- [All prompts and expected outcomes](audit/intent-cases.json)
- [Main baseline results](audit/keyword-baseline.json), [baseline failure CSV](audit/keyword-baseline-failures.csv)
- [Main results after fixes](audit/keyword-improved.json)
- [Held-out results](audit/holdout-improved.json), [remaining failure CSV](audit/holdout-improved-failures.csv)
- [Live stress baseline](audit/live-baseline.json), [live stress after fixes](audit/live-improved.json)
- [Paced provider results](audit/paced-improved.json)
- [Model contract baseline](audit/model-contracts-baseline.json), [final contract results](audit/model-contracts.json)
- [All-component browser checks](audit/ui-render.json)
- [Harness instructions](client/scripts/intent-audit/README.md)

The paced run began before the final contradictory-status guard was added; its selected component requests do not contain those status-filter cases. Final status/continuation behavior is covered by contract/regression tests and the rerun deterministic corpus. The recorded source hash is a limited provenance check, not an immutable whole-repository/provider snapshot.

No production records, actual Google events or user account data were modified. All live AI requests used synthetic goals/catalogs. Provider fallback messages may include provider-supplied organization/rate-limit metadata; no API keys are included in audit artifacts.

## Final verification

The full automated suite passes **310/310 tests** after the changes. Production build passes; lint has existing repository warnings and no errors. The audit adds 15 focused regression tests for observed record/text removal, component aliases, combined selections and contradictory status outputs.
