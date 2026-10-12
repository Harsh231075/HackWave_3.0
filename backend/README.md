# Orlo standalone local MongoDB backend

A separate backend for reviewing Orlo's domain API and database design. It uses real local MongoDB, not memory storage. No users, login, frontend connection, or Google/Gmail mutations are implemented here. Existing AI/Calendar endpoints in `client/server/` remain untouched.

## Run

Requires Node 22.18+ and MongoDB running locally on port 27017.

```sh
cd backend
npm install
cp .env.example .env
npm start
```

Defaults: `http://127.0.0.1:4000`, database `orlo_demo`. The process connects before accepting requests and reports a connection error if MongoDB is unavailable. `.env` can override the URI and port. Records persist across backend restarts.

## Structure

```text
src/
  index.ts                 HTTP server and lifecycle
  database.ts              MongoDB connection and indexes
  models/contracts.ts      14 validated domain schemas
  models/index.ts          Mongoose schemas, models and indexes
  repositories/mongo.ts    MongoDB queries and atomic revision checks
  controllers/records.ts   Input validation and relationship checks
  routes/api.ts            HTTP routing, response codes and errors
  errors.ts                Structured API errors
```

Model field definitions come from the shared Zod contracts, preventing a separate API/model field list from drifting. Mongoose validation also checks the complete contract, including nested workspace properties. Schema definitions and validation follow the [Mongoose schema guide](https://mongoosejs.com/docs/guide.html) and [validation guide](https://mongoosejs.com/docs/validation.html).

## Models and API collections

| Model | Collection / API name | Purpose |
|---|---|---|
| Task | tasks | Owner, due date, duration, priority, status |
| Event | events | Meetings, focus blocks, classes and breaks |
| Note | notes | Body, kind, pin and optional event reference |
| Resource | resources | Content, type, description and tags |
| Attachment | attachments | File metadata and storage key |
| RecordLink | links | Explicit relationships between records |
| Issue | issues | Owner, status and optional event reference |
| Communication | communications | Stored context messages, not Gmail mail |
| UsageObservation | usage-observations | Daily sessions by segment |
| UsageRelease | usage-releases | Release context for usage investigation |
| PluginSettings | plugin-settings | Enable state and configuration |
| VoiceNote | voice-notes | References to a note and audio attachment |
| Workspace | workspaces | Component order, sizes, pins, properties and goal targets |
| Activity | activity | Activity schema and read endpoints |

The application has no user/organization models. Everything is one local demo dataset. Calendar and Meetings use the same Event records; UI components do not each need a separate collection. Workspace components have registered widget IDs and unique instance IDs. This normalized backend workspace contract is not yet mapped to the frontend's saved workspace document.

## Routes

Prefix: `/api/v1`.

- `GET /health`: MongoDB state and demo scope.
- `GET /schemas`: registered model/collection names.
- `GET /:collection`: list records.
- `POST /:collection`: create a record; returns `201` and a `Location` header.
- `GET /:collection/:id`: retrieve a record and its `ETag`.
- `PATCH /:collection/:id`: update requested fields.
- `DELETE /:collection/:id`: delete a record; returns `204`.

CRUD is available for the first 13 collections above. Activity is read-only; automatic audit logging is not part of this scaffold. There are no auth, email-send or Google Calendar routes in this new backend.

List parameters: `q`, `status`, `owner`, `from`, `to`, `limit` (1–100), `offset`. List filtering scans at most 1,000 records in this demo implementation; `pagination.total` describes that bounded result, not an unlimited database count.

Responses use `{ "data": ... }`. Records contain server-managed `id`, `revision`, `createdAt`, and `updatedAt`. Unknown fields and client-supplied metadata are rejected. Validation errors return `422`, missing records `404`, duplicate records or stale revisions `409`, and missing write preconditions `428`.

### Demo: task create → read → update → delete

```sh
curl http://127.0.0.1:4000/api/v1/health

curl -X POST http://127.0.0.1:4000/api/v1/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare meeting agenda","owner":"Alex","due":"2026-10-13","priority":"high"}'

# Replace TASK_ID with the id returned above.
curl http://127.0.0.1:4000/api/v1/tasks/TASK_ID

curl -X PATCH http://127.0.0.1:4000/api/v1/tasks/TASK_ID \
  -H 'Content-Type: application/json' -H 'If-Match: 1' \
  -d '{"status":"completed"}'

curl -X DELETE http://127.0.0.1:4000/api/v1/tasks/TASK_ID \
  -H 'If-Match: 2'
```

`If-Match` must contain the current revision. Concurrent edits cannot both overwrite revision 1. Stale delete requests also fail. Linked records must be unlinked before deleting; these demo relationship checks are not cross-document transactions.

### Other examples

```sh
curl -X POST http://127.0.0.1:4000/api/v1/events \
  -H 'Content-Type: application/json' \
  -d '{"title":"Client review","date":"2026-10-13","start":"10:00","end":"11:00","participants":["Alex"],"agenda":"Review priorities"}'

curl -X POST http://127.0.0.1:4000/api/v1/resources \
  -H 'Content-Type: application/json' \
  -d '{"title":"Product brief","kind":"document","body":"Review material","tags":["meeting"]}'

curl -X POST http://127.0.0.1:4000/api/v1/workspaces \
  -H 'Content-Type: application/json' \
  -d '{"title":"Meeting prep","components":[{"instanceId":"meeting-view","widgetType":"meetings","span":"wide"},{"instanceId":"notes-view","widgetType":"outline","span":"narrow"}],"context":{"goal":"Prepare tomorrow meeting","targetInstanceIds":["meeting-view","notes-view"]}}'
```

Attachment APIs store metadata only, not uploaded file/audio bytes. Gmail/OAuth secrets must not be put in PluginSettings. These local APIs do not change or replace frontend storage.

## Verify

```sh
npm run check
npm test
npm run test:integration
```

`npm test` validates all 14 models without opening a MongoDB connection. The opt-in integration suite tests real HTTP CRUD against local MongoDB, validates persistence through a fresh repository, checks concurrent edits, duplicates, relationships and malformed requests. It creates a uniquely named `orlo_backend_test_*` database and drops only that database in cleanup. It never touches `orlo_demo` or other existing databases.

Judge explanation: "The frontend demonstrates intent-to-interface. Separately, we have implemented MongoDB models and validated CRUD APIs. Connecting the frontend to these APIs is a future integration step."

## Seed the frontend's demo dataset into MongoDB

```sh
cd backend
npm run seed
```

The seed invokes the existing `client/src/services/demoSeedService.ts` generator offline, validates the result, and inserts it into MongoDB. Both package dependencies must be installed. This does not connect the running frontend to the backend and does not read or alter browser storage or personal Google data.

It installs the same **sample** content: 12 tasks, 12 events (including 5 meetings), 8 notes with their actual draft bodies, 6 resources, 4 issues, 4 communications, 56 usage observations, 2 usage releases, and 24 relationships. Frontend meeting IDs are mapped to their canonical backend Event IDs. Previous-meeting and release evidence links are preserved. Empty attachments/voice notes/plugin settings/workspaces are not fabricated.

Dates use Asia/Calcutta today on the first run. To choose the same date as a previously seeded frontend demo:

```sh
SEED_DATE=2026-10-12 npm run seed
```

Stable seed IDs and `$setOnInsert` preserve existing records and edits. The original reference date is saved in `_seed_runs`, so later reruns skip the same records rather than shifting dates or making duplicates. Existing observations with the same date/segment are also preserved. It never resets the database. A seed failure can be retried to complete missing rows.

This reproduces the frontend's default sample data, not manually edited records currently stored in a particular browser. Those would require a separate browser-data export/import.

```sh
npm run test:seed
```

The seed integration test uses and cleans only a new `orlo_seed_test_*` database; it checks exact record counts, relationships, repeated runs, and preservation of edited/manual records.
