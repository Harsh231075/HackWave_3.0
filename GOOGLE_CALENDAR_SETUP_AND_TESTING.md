# Google Calendar — setup and testing

The implementation now includes server-side Google OAuth, encrypted session/token storage, token refresh, primary-calendar reading, meeting preparation, local layout commands, previewed scheduling, and confirmed event creation.

## Run with the supported Node version

```bash
cd client
nvm use
npm run dev
```

The repository pins Node 22.18.0 in `client/.nvmrc`. If it is not installed, use `nvm install` first. Restart an already-running development server so it picks up the calendar handlers and environment settings.

Open **http://localhost:5173/**. Use this exact hostname and port for Google authorization; `127.0.0.1` is not interchangeable with the configured OAuth callback.

## Required configuration

Keep these settings in ignored `client/.env.local`, alongside the existing server-only model configuration:

```dotenv
GOOGLE_CLIENT_ID=your_web_application_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/api/calendar/google/callback
APP_ORIGIN=http://localhost:5173
```

Enable Google Calendar API in the Google Cloud project. Configure the OAuth client as a **Web application**, register the exact callback above, and add your Google account as a test user if the consent app is in testing mode. Start with event-read permission; scheduling requests event-write permission when required.

Use **Workspace options → Google Calendar connection → Connect Google Calendar**. Complete Google's account selection and permission screen yourself. On the granular permissions page, explicitly select permission to view calendar events; approving Google sign-in alone is insufficient. If calendar permission is missing, the callback returns to Orlo with a reconnect message rather than a raw JSON page. The application never needs your Google password.

Credentials are not returned to the browser. Tokens and server sessions are encrypted in `client/server/.calendar-data/`, which is ignored by Git. A private encryption key is generated for local development. Keep this directory private and persistent; losing it disconnects accounts and loses operation receipts.

## Conversation UI flow

The initial dashboard stays visible. Press Cmd/Ctrl+K to open the existing prompt popup and submit the first goal. The popup then closes into a conversation canvas: your prompt appears above the interactive components, and a persistent bottom composer accepts text or speech follow-ups. The Orlo header remains at the top.

After entering conversation mode, Cmd/Ctrl+K focuses the bottom composer. Clarifications, calendar connection recovery, meeting selection, scheduling details, available slots, editable preview and confirmation appear inline. Workspace options still provide layout undo and reset. Reset returns to the original dashboard without deleting task or calendar records.

Conversation summaries and the active layout restore on reload. Save preparation notes explicitly to keep them across reloads; unsaved buffers remain available while changing layouts during the session. Every prompt is followed by its own response. Before a follow-up, the previous UI is frozen as a read-only snapshot in that turn, and the new editable response appears below it. Field values and displayed records in historical snapshots do not change with later edits; old forms cannot submit or make network requests. Calendar snapshots are shown only for their original connected account. The newest response is the active workspace. Explicit tool requests show only their requested components: “add tasks” after a calendar response renders Tasks only, not Calendar plus Tasks. The working layout and data remain available for follow-ups, but old components are not copied into new replies. Goal-based preparation can still compose multiple tools when that goal calls for them.

## Product checks

### Read the real calendar

1. Connect Google Calendar.
2. Open the Calendar page, or press Cmd/Ctrl+K and enter **“add calendar”**.
3. Choose a date and refresh.
4. Confirm the displayed events match your primary Google calendar.
5. Expand an event to inspect its actual attendees, description, location and meeting link.

Connected views use real Google events; disconnected views explicitly label the local demo calendar. Importing events does not overwrite local demo records.

### Prepare for a meeting

1. Cmd/Ctrl+K → **“Prepare for tomorrow’s meeting.”**
2. Choose the matching real event; the app does not guess which client or attendee you meant.
3. Inspect details and write preparation notes.
4. Save the notes, then try **“make calendar full width”**, **“remove calendar”**, and **“add calendar.”**
5. Verify notes remain. Use **Workspace options → Undo layout change**.
6. Reload and verify the selected meeting is revalidated against Google and saved notes remain.

Tomorrow uses the real date in the browser's timezone. Demo workflows retain their separately labelled demo date. You can choose another preparation date in the UI or include an explicit YYYY-MM-DD date in the goal.

The model arranges only verified event details, preparation notes and calendar. If model composition is unavailable, a deterministic preparation layout keeps the real event usable. Email/document/project context is not invented or automatically imported. Preparation notes are local and do not edit Google's event description. Notes not explicitly saved remain session-only.

### Arrange a new meeting

1. Cmd/Ctrl+K → **“Schedule a meeting with Alex tomorrow.”**
2. Enter Alex's actual email, a title, date, duration, timezone and agenda.
3. Use **Find available slots**, or choose a preferred time manually.
4. Review the meeting. Available slots check **your primary calendar only**; guest availability is unknown.
5. If required, click **Allow event creation**, complete Google consent, and return to the saved preview.
6. Inspect the exact time, timezone and guests before clicking **Confirm and create**.
7. Verify one real event in Google Calendar. Invitations are sent to the listed guests.

No remote write happens when a preview is generated. Confirmation checks known calendar conflicts again. Duplicate confirmations reuse the server operation and provider event ID. If the response is lost, **Check / retry confirmation** reconciles the existing event before trying again. Do not create a different preview to work around an uncertain result.

A confirmed event uses the provider's returned details. Google Meet link creation, attendee-calendar access, rescheduling, recurring-series edits, Outlook, and email/document ingestion are not included in this first implementation.

### Failure checks

- Decline read permission: no false success; the goal/layout remains available.
- Disconnect: Google authorization is revoked and the UI returns to the labelled local calendar.
- Select a date without events: the UI offers another date or a new meeting.
- Change/cancel the event externally: refresh/retry to revalidate it; local preparation notes remain separate.
- Create a conflict after reviewing: confirmation rejects the occupied slot rather than creating another event.
- Decline write permission: preparation remains available; meeting creation remains disabled.
- Lose the model connection: real event preparation falls back to a local layout.
- Use “add calendar” in an existing meeting/usage/overdue layout: scope, filters and records stay intact.

## Automated verification

```bash
cd client
nvm use
npm test
npm run lint
npm run build
```

Calendar tests use mocked Google responses and fake credentials. They cover OAuth state/replay, session rotation/isolation, encrypted storage/restart, token refresh, pagination, date/DST normalization, permissions, conflicts, previews, duplicate prevention, uncertain-creation recovery, and local layout patches.

A separate isolated-browser check exercised add-calendar, real-event selection, note retention during resizing, slot selection, preview and confirmed creation using mocked API responses. It did not sign in to Google or send a real invitation. The first live account consent and real-event smoke test must be completed in your browser.

## Deployment boundary

This MVP uses a single Node process with an encrypted atomic file store, not a multi-instance database. For deployment:

- Set `APP_ORIGIN` and `GOOGLE_REDIRECT_URI` to the real HTTPS origin and register that callback in Google Cloud.
- Set `NODE_ENV=production`, a persistent `CALENDAR_DATA_DIR`, and a durable `CALENDAR_TOKEN_KEY` containing 64 hexadecimal characters.
- Keep the key outside source control and configure credentials in the hosting platform's server secrets.
- Run one backend instance against this store. Multiple replicas require a shared transactional repository and operation locking before use.
- Use `npm run build` then `npm start`; `npm run preview` does not install API routes.

This setup implements read-on-open/manual refresh. Incremental background sync, calendar selection, push notifications, shared-calendar availability and multi-device draft synchronization remain follow-up work.
