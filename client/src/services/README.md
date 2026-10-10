# Orlo browser services

`index.ts` exports one configured `browserDatabase` and the services that use it. Factories accept an injected database or storage adapter for tests. Imports never load or write browser data.

## Shared database

`browserDatabase.ts` owns the current workspace state, subscriptions, domain reducer, undo history, and persistence writer. `WorkspaceProvider` subscribes with `useSyncExternalStore`; it no longer owns a separate reducer or saves competing snapshots. Direct service mutations therefore update standard pages and generated widgets immediately.

- `getState()` returns the current stable workspace snapshot for subscriptions/internal reads.
- `subscribe(listener)` returns an unsubscribe callback.
- `dispatch(action)` applies domain actions, persists domain records, and notifies subscribers.
- `replaceRecords(snapshot)` validates a replacement snapshot before applying it.
- `reset()` restores the demo domain records.
- `readCollection(key)` / `writeCollection(key, value)` handle additional local entities.
- `getPersistenceResult()` reports whether the latest write was saved, invalid, or unavailable.
- `storage` is the shared adapter used for legacy layout and preference keys.

Workspace records retain `gogpt-workspace-v1`. Layout retains `gogpt-app-layout-v1`; preferences retain `task-view`, `calendar-view`, and `calendar-category`. Additional collections live in a versioned `orlo-browser-db-v1` record. Reads preserve malformed saved data. Failed storage writes leave valid edits usable in memory.

## Service catalog

| Service | Methods | Data and behavior |
| --- | --- | --- |
| Workspace | `load`, `save` | Shared domain snapshot |
| Tasks | `list`, `getById`, `create`, `update`, `save`, `delete`, `toggle` | Tasks/todos, existing filters, domain validation |
| Events | `list`, `getById`, `create`, `update`, `save`, `delete` | Calendar, meetings, timeline; range/category filters and conflicts |
| Drafts | `get`, `save`, `delete` | Shared editable outlines |
| Activity | `list` | Existing bounded domain activity; optional limit |
| Availability | `isAvailable`, `findSlots` | Derived from the same event records; device-local scheduling |
| Recommendations | `list`, `accept`, `dismiss` | Local focus suggestions; acceptance creates a shared event |
| Analytics | `getTaskSummary`, `getOverview` | Counts and scheduled minutes derived from current records |
| Search | `search` | Matching tasks, events, and resources |
| Resources | `list`, `getById`, `create`, `update`, `delete` | Demo resource seeds and locally stored edits |
| Layout | `load`, `save`, `clear` | Validated generated OpenUI response |
| Preferences | `load`, `save` | List/Kanban and calendar display settings |
| Generation | `generate` | Existing generation endpoint; shared records passed as context |
| Profiles | `list`, `getById`, `create`, `update`, `delete`, `getProfile`, `updateProfile` | Local names, optional email, timezone |
| Projects | `list`, `getById`, `create`, `update`, `delete` | Local metadata; existing task context fields are unchanged |
| Notifications | `list`, `getById`, `create`, `update`, `delete`, `markRead`, `getSettings`, `updateSettings` | Local messages and settings; no reminder delivery engine |
| Auth | `getSession`, `selectLocalProfile`, `signIn`, `signOut` | Browser-only profile selection; real sign-in returns unavailable |
| Calendar integrations | `listConnections`, `saveConnection`, `disconnect`, `connect`, `sync` | Disconnected local metadata; external connection/sync returns unavailable |
| Sharing | `listMembers`, `addLocalMember`, `removeMember`, `invite` | Local member references; email invitations return unavailable |
| Files | `list`, `upload`, `getDownloadUrl`, `revokeDownloadUrl`, `delete` | Local attachment content, maximum 2 MB per file |

Task/event/draft commands preserve existing activity and 20-step undo behavior. Deleting tasks and drafts is also undoable. Undo does not include additional profile/project/file collections. Demo reset changes domain records only; layout reset changes layout only.

## Usage

Import configured services from `@/services`. Mutation results are `{ ok: true, value }` or `{ ok: false, message }`. Local mutation success means the record was accepted in memory; check the database persistence result when presenting save guarantees. Read methods return copies of entity records.

Existing UI is connected to task/event/draft mutations, task/calendar queries, availability, metrics, resources, recommendations, activity, preferences, layouts, and generation. Additional feature services are callable local interfaces with tests; new account/upload/sharing/settings screens are not introduced by this refactor.

Authentication does not authenticate users or enforce access control. Local member records do not transmit or share data. Calendar metadata does not authorize an external calendar. Notifications do not send messages. `signIn`, `invite`, `connect`, and `sync` return explicit unavailable results instead of pretending to perform external operations.

File uploads read a Blob and store its content locally. Download URLs are temporary blob URLs; the caller must revoke them with `revokeDownloadUrl` when finished. Storage quota failures can make attachments session-only.

`api/httpClient.ts` centralizes JSON HTTP responses, service errors, and cancellation. Generation remains the only existing network integration. Later backend adapters must define asynchronous loading, server IDs, server-authoritative scheduling, and remote undo explicitly. Browser storage is local to this browser; there is no cross-device or automatic cross-tab synchronization.
