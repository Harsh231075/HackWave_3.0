import metadata from './metadata.json' with { type: 'json' }
import type { ExtensionDefinition } from '../contracts.ts'
export const quickTimerDefinition: ExtensionDefinition = { iconSvg: metadata.iconSvg, id: 'quick-timer', widgetId: 'quick-timer', title: 'Quick Timer', description: 'Time a focused work session.', aiDescription: 'A user-controlled focus timer. Select for timed focused work. Configure 1–180 minutes; never start it automatically.', supportedBindings: ['workspace'] }
