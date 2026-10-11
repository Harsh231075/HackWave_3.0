import { mailDefinition } from './mail/definition.ts'
import { isMailWidget } from '../domain/mail.ts'
import { calculatorDefinition } from './calculator/definition.ts'
import { externalPluginDefinition } from './external/definition.ts'
import { extensionIds, type ExtensionId } from './contracts.ts'
import { quickTimerDefinition } from './quick-timer/definition.ts'
import { voiceNoteDefinition } from './voice-note/definition.ts'
export const extensionCatalog = [quickTimerDefinition, voiceNoteDefinition, calculatorDefinition, externalPluginDefinition, mailDefinition] as const
export const extensionForWidget = (id: string): ExtensionId | undefined => isMailWidget(id) ? 'mail' : extensionIds.includes(id as ExtensionId) ? id as ExtensionId : undefined
export const isExtension = (id: string) => !!extensionForWidget(id)
export const capabilityAllowed = (widget: string, enabled: readonly ExtensionId[] = []) => !extensionForWidget(widget) || enabled.includes(extensionForWidget(widget)!)
export const enabledCapabilityDescriptions = (enabled: readonly ExtensionId[]) => extensionCatalog.filter(item => enabled.includes(item.id)).map(item => `${item.id}: ${item.aiDescription}`)
