import { widgetLayoutCatalog } from '@/domain/widgetLayout'
import { generatedActionsValid } from './actionValidation'
import type { Task } from '@/domain/types'
import { extractActiveWidgets } from './workspaceNodes'
import { createParser } from '@openuidev/react-lang'
import { productivityLibrary } from './OpenUIWorkspace'


export function repairOpenUI(code: string): string {
  return code
    .replace(/^```[^\n]*\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .replace(/FormControl\(([^,]+),\s*([^,)]+(?:\([^)]*\))?),\s*\{[^}]*\}\)/g, 'FormControl($1, $2)')
    .replace(/Button\(([^,]+,[^,]+,[^,)]+),\s*"(?:small|medium|large|extra-small)"\)/g, 'Button($1)')
    .trim()
}

export function validLayout(response: string): boolean {
  try {
    const parser = createParser(productivityLibrary.toJSONSchema(), productivityLibrary.root)
    const parsed = parser.parse(response)
    const widgets = extractActiveWidgets(response, productivityLibrary.toJSONSchema(), productivityLibrary.root)
    const unique = new Set(widgets.map(w => w.id)).size === widgets.length && widgets.length <= 14
    return unique && widgets.every(w => widgetLayoutCatalog[w.id].some(v => v.version === (w.layoutVersion ?? 1))) && !!parsed.root && !parsed.meta.errors.length && !parsed.meta.incomplete && !parsed.meta.unresolved.length && !parsed.queryStatements.length && !parsed.mutationStatements.length
  } catch { return false }
}

export function validGeneratedLayout(response: string, tasks: Task[]) {
  return validLayout(response) && generatedActionsValid(response, productivityLibrary.toJSONSchema(), productivityLibrary.root, tasks)
}
