import { createParser } from '@openuidev/react-lang'
import { widgetTypes, type WidgetType } from './config'
import type { WidgetInstance } from '@/domain/widgetInstances'

export function extractActiveWidgets(response: string, library: Parameters<typeof createParser>[0], root: Parameters<typeof createParser>[1]): Array<{ id: WidgetType; span: WidgetInstance['span'] }> {
  const parsed = createParser(library, root).parse(response)
  if (!parsed.root || parsed.meta.errors.length || parsed.meta.incomplete || parsed.meta.unresolved.length || parsed.queryStatements.length || parsed.mutationStatements.length) return []
  const widgets: Array<{ id: WidgetType; span: WidgetInstance['span'] }> = []
  const visit = (node: unknown) => {
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (!node || typeof node !== 'object') return
    const element = node as { typeName?: string; props?: { id?: WidgetType; span?: WidgetInstance['span'] } }
    if (element.typeName === 'WorkspaceWidget' && element.props?.id && widgetTypes.includes(element.props.id) && ['wide', 'narrow', 'full'].includes(element.props.span ?? '')) widgets.push({ id: element.props.id, span: element.props.span! })
    Object.values(node).forEach(visit)
  }
  visit(parsed.root)
  return widgets
}
