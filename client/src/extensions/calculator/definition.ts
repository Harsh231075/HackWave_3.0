import metadata from './metadata.json' with { type: 'json' }
import type { ExtensionDefinition } from '../contracts.ts'
export const calculatorDefinition: ExtensionDefinition = { iconSvg: metadata.iconSvg, id: 'calculator', widgetId: 'calculator', title: 'Calculator', description: 'Calculate totals, percentages and everyday arithmetic.', aiDescription: 'An interactive arithmetic calculator for user-entered calculations. Supports parentheses, percentages and operator precedence. Never invent financial records.', supportedBindings: ['workspace'] }
