# Browser-only Gmail Mail

Mail is a built-in Orlo extension. It calls Gmail directly from the browser using Google Identity Services. It adds no Mail server endpoints and requires no client secret, refresh token, API key, database or mail server.

## Configure Google

1. Create a dedicated Google Cloud project for Mail, separate from the existing Calendar integration, and enable **Gmail API**.
2. Configure Google Auth Platform branding/audience for a private demo. Add your Gmail account as an OAuth test user.
3. Add the `https://www.googleapis.com/auth/gmail.modify` scope. This is a restricted scope; public distribution requires reviewing Google's verification requirements.
4. Create an OAuth client of type **Web application**. Register the exact JavaScript origins you use, such as `http://localhost:5173`. Localhost development is supported; deployed origins must use HTTPS. This popup token flow needs no backend callback URL.
5. Put the public OAuth client ID in `client/.env.local`:

   ```env
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   ```

6. Restart Vite, or rebuild for static hosting. Open **Plugins → Mail → Enable → Connect Gmail**, approve Gmail permissions, then use **Try it** or ask the dashboard to show your inbox. Mail is available through extension components; there is no dedicated Mail route.

This public client ID identifies the application; it is not a secret. Never put OAuth client secrets or refresh tokens in `VITE_*` variables. Gmail API requests use the short-lived access token returned by Google. Google supports browser REST requests through CORS.

## Behavior

- One connected mailbox per tab. Tokens, full message bodies, selected messages, draft text and attachment bytes live only in memory. Account-qualified list headers/previews cache in localStorage for five minutes (20 pages, 250,000 characters maximum). Gmail owns saved drafts and sent mail.
- Inbox, All Mail (excluding Spam/Trash), Sent, Drafts, Trash, Gmail-syntax search and Previous/Next paging are supported. Lists show five messages per page. Cached pages are reused across navigation/reload after authorization; simultaneous readers share one request.
- Selecting an inbox message opens its content in a modal instead of an inline panel.
- Inbox composition opens in a modal only after Compose, Reply/Forward, or opening a saved draft. Closing the modal preserves the current draft; Compose reopens it. The standalone dashboard composer remains inline.
- The composer header offers a saved-draft picker, with five drafts per page through the Mail service/cache. Selecting a draft fills the form; unsaved edits and in-flight operations prevent replacement.
- Plain-text compose shows To/Subject/Message immediately, with Cc/Bcc revealed on demand (or when populated), reply/reply-all, forward and attachments (10 MiB combined). Download files from the viewer; use **Add to draft** to forward an original attachment explicitly.
- Drafts autosave after one second of inactivity. Invalid recipient/header input or request failure leaves edits in the tab with an error. Use Save draft to retry. External draft changes detected before an update block the overwrite; Save as new draft preserves your edits separately. Gmail does not offer atomic compare-and-swap for draft updates.
- Sending requires a Send click. Concurrent sends are blocked. An ambiguous network failure shows **Check Sent before retrying** and does not automatically resubmit. Inspect Sent, then discard the uncertain editor before composing again if appropriate.
- Google tokens expire. Reconnect is user-triggered; edits remain in memory through expiry/reconnect. Reload clears unsaved edits and authorization. Before reload/close, the browser warns about unsaved work when supported. Saved Gmail drafts are available after reconnection.
- Formatted mail is sanitized and displayed in an iframe without script permissions; forms, embedded files and remote images are blocked. Plain text remains available.
- **Disconnect** clears this tab's Mail data and the list cache, after unsaved edits are resolved. **Revoke Google access** removes consent for the separate Mail Google project. With expired access, use the Google account permissions link.
- Disabling Mail clears in-memory access after draft saves finish and unsaved work is resolved. Workspace data reset also clears in-memory Mail access. Neither action deletes Gmail records.
- Dashboard commands such as “show my inbox,” “show sent mail,” and “write an email” select widgets locally. Commands do not send or change email. Mail content is not included in model prompts or Orlo API payloads. Pins save mailbox/message/draft references and folder settings only.
- Browsing checks every 60 seconds while visible and on focus; fresh cached lists avoid network requests. Manual Refresh bypasses the cache. Successful mail/draft changes, account switching, disconnect/revoke, disabling Mail and local data reset invalidate cached lists. There is no offline mailbox or synchronization after closing the browser.

## Service boundary

Mail widgets use `mailService` for Google SDK preparation, connection, Gmail reads/writes, draft state and cache invalidation. `mailRuntime` injects Google authorization and text conversion; `mailCache` is an internal service dependency. Components own rendering, form visibility, file selection/download and view navigation only.

List headers/previews use the bounded five-minute localStorage cache. Full messages use a five-minute memory cache (50 messages maximum), with isolated return values and stale-response protection after refresh or mutations. Attachment downloads remain on demand; bodies, attachment bytes, tokens and unsaved drafts are not persisted to localStorage. Mutations always reach Gmail and are never served from cache. Authorization is required even for cached reads; this cache does not preserve login after reload.

## Verify

Run from `client/`:

```bash
npm test
npm run build
npm run lint
npm run test:mail
```

The browser check uses mocked Google authorization and Gmail responses and does not send real email. Supply `ORLO_PLAYWRIGHT_MODULE` and `ORLO_CHROME_PATH` if Playwright/Chromium are installed elsewhere. Live verification requires the Google configuration above and a consenting test account: receive/read, reply, save/reopen a draft, send an attachment to a controlled address, archive/trash/restore, reconnect, then revoke access.

Official references: [Google browser token flow](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Gmail JavaScript quickstart](https://developers.google.com/workspace/gmail/api/quickstart/js), [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes).
