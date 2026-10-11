import { z } from 'zod'
export const extensionIds = ['quick-timer', 'voice-note', 'calculator', 'external-plugin', 'mail'] as const
export type ExtensionId = typeof extensionIds[number]
export const extensionSettingsSchema = z.object({ version: z.literal(1), enabled: z.array(z.enum(extensionIds)).max(extensionIds.length) })
export interface ExtensionDefinition { id: ExtensionId; widgetId: ExtensionId | 'mail-inbox'; title: string; iconSvg: string; description: string; aiDescription: string; supportedBindings: readonly ('workspace' | 'gmail')[] }
