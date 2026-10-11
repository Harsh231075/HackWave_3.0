import { extensionIds, type ExtensionId } from './contracts.ts'
import { quickTimerDefinition } from './quick-timer/definition.ts'
import { voiceNoteDefinition } from './voice-note/definition.ts'
export const extensionCatalog = [quickTimerDefinition, voiceNoteDefinition] as const
export const isExtension = (id: string): id is ExtensionId => extensionIds.includes(id as ExtensionId)
export const capabilityAllowed = (widget: string, enabled: readonly ExtensionId[] = []) => !isExtension(widget) || enabled.includes(widget)
export const enabledCapabilityDescriptions = (enabled: readonly ExtensionId[]) => extensionCatalog.filter(item => enabled.includes(item.id)).map(item => `${item.widgetId}: ${item.aiDescription}`)
