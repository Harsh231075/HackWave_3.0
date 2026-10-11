# Resources module

Resources is available from the sidebar. The Library and generated workspace components read the same local resource store.

Ctrl/Cmd+K → “Create a resource” renders the registered `resource-create` component. The AI selects a form; only the user's Save action creates a record. Existing components remain until explicitly removed. Each creation instance owns a separate persisted draft. Unsaved file selections require reattachment after reload.

Resources support notes, HTTP/HTTPS links, document text, attachments up to 2 MB, description, tags, and links to local tasks, projects and meetings. Project/preparation meeting relationships use the existing relationship service. Task and other local meeting references use resource properties. These references do not attach a document to a Google Calendar event.

Library browsing, details, editing and deletion confirmation render inline. Deleting a resource removes its record relationships and properties, while retaining uploaded file content. Local storage failures show session-only save notices. No cloud storage or collection Undo is advertised.

## Manual walkthrough

1. Press Ctrl/Cmd+K and enter “Show my tasks”. Then enter “Create a resource”. Check the form appears on the canvas without another dialog, alongside Tasks.
2. Enter a name, content, description and comma-separated tags. Open linking controls and choose a task/project. Click Save resource; open Resources from the sidebar and check the record and properties.
3. Open the resource, click Edit resource, change its name and save. Check Library and any open workspace details update together.
4. Request “Create another resource”. Enter different draft text into two forms. Navigate away/back and reload; check drafts remain independent.
5. Choose Link and enter an invalid/non-HTTP URL; saving must fail with the form preserved. For Attachment, select a small file, save and download it; files larger than 2 MB must be rejected.
6. Click Delete resource and then Keep resource; verify no deletion. Confirm deletion and check the Library updates; a saved creation card should report that its record was removed.
7. Enter “show my all resources and remove current existing all components”. Expect only Resources Library. The intent endpoint should accept clear/add operations; AI remains first, with Keyword fallback if the provider fails.
8. Negated or hypothetical removal prompts must not clear the canvas.

## Automated checks

`client/server/resourceModule.test.ts` covers creation intent, independent canvas instances/drafts, record/property/link lifecycle, stale editors, invalid data, legacy relationships, attachments and combined clear/add wording. The isolated browser walkthrough exercises inline create/edit/delete, preservation of existing tasks and draft survival across navigation/reload with mocked AI responses.
