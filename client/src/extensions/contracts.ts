import { z } from 'zod'
export const extensionIds = ['quick-timer', 'voice-note'] as const
export type ExtensionId = typeof extensionIds[number]
export const extensionSettingsSchema = z.object({ version: z.literal(1), enabled: z.array(z.enum(extensionIds)).max(2) })
export interface ExtensionDefinition { id: ExtensionId; widgetId: ExtensionId; title: string; description: string; aiDescription: string; supportedBindings: readonly ['workspace'] }
