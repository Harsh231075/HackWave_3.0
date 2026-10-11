import type { ExtensionDefinition } from '../contracts.ts'
export const externalPluginDefinition: ExtensionDefinition = { id: 'external-plugin', widgetId: 'external-plugin', title: 'External plugin', description: 'An imported plugin.', aiDescription: 'An isolated imported plugin. Select externalPluginId from the enabled plugin catalog.', supportedBindings: ['workspace'] }
