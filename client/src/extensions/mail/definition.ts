import metadata from './metadata.json' with { type: 'json' }
import type { ExtensionDefinition } from '../contracts.ts'
export const mailDefinition: ExtensionDefinition = { iconSvg: metadata.iconSvg,
  id: 'mail', widgetId: 'mail-inbox', title: 'Mail',
  description: 'Connect Gmail to read, search, compose and send mail directly from your browser.',
  aiDescription: 'Mail widgets: mail-inbox for Inbox/Sent/Drafts browsing, mail-message for the selected email, mail-compose for a user-controlled composer. Mail is account-scoped, requires no project, and never sends or mutates mail through commands. Email content is not available to the model.',
  supportedBindings: ['gmail'],
}
