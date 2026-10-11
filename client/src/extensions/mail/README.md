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

6. Restart Vite, or rebuild for static hosting. Open **Plugins → Mail → Enable → Connect Gmail**, approve Gmail permissions, then choose **Open Mail**. The sidebar also includes Mail.

This public client ID identifies the application; it is not a secret. Never put OAuth client secrets or refresh tokens in `VITE_*` variables. Gmail API requests use the short-lived access token returned by Google. Google supports browser REST requests through CORS.

## Behavior

- One connected mailbox per tab. Tokens, message caches, selected messages, draft text, and attachment bytes live only in memory. Gmail owns saved drafts and sent mail.
- Inbox, All Mail (excluding Spam/Trash), Sent, Drafts, Trash, Gmail-syntax search and Load more are supported. Lists load 25 messages per page.
- Plain-text compose supports To/Cc/Bcc, reply/reply-all, forward and attachments (10 MiB combined). Download files from the viewer; use **Add to draft** to forward an original attachment explicitly.
- Drafts autosave after one second of inactivity. Invalid recipient/header input or request failure leaves edits in the tab with an error. Use Save draft to retry. External draft changes detected before an update block the overwrite; Save as new draft preserves your edits separately. Gmail does not offer atomic compare-and-swap for draft updates.
- Sending requires a Send click. Concurrent sends are blocked. An ambiguous network failure shows **Check Sent before retrying** and does not automatically resubmit. Inspect Sent, then discard the uncertain editor before composing again if appropriate.
- Google tokens expire. Reconnect is user-triggered; edits remain in memory through expiry/reconnect. Reload clears unsaved edits and authorization. Before reload/close, the browser warns about unsaved work when supported. Saved Gmail drafts are available after reconnection.
- Formatted mail is sanitized and displayed in an iframe without script permissions; forms, embedded files and remote images are blocked. Plain text remains available.
- **Disconnect** clears this tab's Mail data, after unsaved edits are resolved. **Revoke Google access** removes consent for the separate Mail Google project. With expired access, use the Google account permissions link.
- Disabling Mail clears in-memory access after draft saves finish and unsaved work is resolved. Workspace data reset also clears in-memory Mail access. Neither action deletes Gmail records.
- Dashboard commands such as “show my inbox,” “show sent mail,” and “write an email” select widgets locally. Commands do not send or change email. Mail content is not included in model prompts or Orlo API payloads. Pins save mailbox/message/draft references and folder settings only.
- Browsing refreshes every 60 seconds while the tab is visible, on focus, or manually. There is no offline mailbox or synchronization after closing the browser.

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
