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
    return !!parsed.root && !parsed.meta.errors.length && !parsed.meta.incomplete && !parsed.meta.unresolved.length && !parsed.queryStatements.length && !parsed.mutationStatements.length
  } catch { return false }
}
