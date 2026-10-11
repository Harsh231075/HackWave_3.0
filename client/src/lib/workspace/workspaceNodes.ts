import { z } from 'zod'
import { createParser } from '@openuidev/react-lang'
import { workspaceActionButtonSchema } from '../../domain/workspaceActions.ts'
import { widgetTypes, type WidgetType } from './config'
import type { WidgetInstance } from '@/domain/widgetInstances'
type Library = Parameters<typeof createParser>[0]
type Root = Parameters<typeof createParser>[1]
function nodes(response: string, library: Library, root: Root) {
  const parsed = createParser(library, root).parse(response)
  if (!parsed.root || parsed.meta.errors.length || parsed.meta.incomplete || parsed.meta.unresolved.length || parsed.queryStatements.length || parsed.mutationStatements.length) return []
  const found: Array<{ typeName: string; props: Record<string, unknown> }> = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    const element = node as { typeName?: string; props?: Record<string, unknown> }
    if (element.typeName && element.props) found.push({ typeName: element.typeName, props: element.props })
    Object.values(node).forEach(visit)
  }
  visit(parsed.root)
  return found
}
export function extractActiveWidgets(response: string, library: Library, root: Root): Array<{ id: WidgetType; span: WidgetInstance['span'] }> {
  return nodes(response, library, root).flatMap(node => node.typeName === 'WorkspaceWidget' && widgetTypes.includes(node.props.id as WidgetType) && ['wide', 'narrow', 'full'].includes(String(node.props.span)) ? [{ id: node.props.id as WidgetType, span: node.props.span as WidgetInstance['span'] }] : [])
}
export function extractGeneratedActions(response: string, library: Library, root: Root): z.infer<typeof workspaceActionButtonSchema>[] {
  return nodes(response, library, root).flatMap(node => { const parsed = node.typeName === 'WorkspaceAction' ? workspaceActionButtonSchema.safeParse(node.props) : null; return parsed?.success ? [parsed.data] : [] }).slice(0, 4)
}
export function extractGeneratedText(response: string, library: Library, root: Root): string {
  return nodes(response, library, root).flatMap(node => node.typeName === 'TextContent' && typeof node.props.text === 'string' ? [node.props.text] : []).join('\n').slice(0, 2000)
}
