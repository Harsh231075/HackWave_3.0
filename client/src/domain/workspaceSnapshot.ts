import { z } from 'zod'
export type WorkspaceSnapshotNode = { tag: string; attributes: Record<string, string>; children: Array<WorkspaceSnapshotNode | string> }
export const workspaceSnapshotNodeSchema: z.ZodType<WorkspaceSnapshotNode> = z.lazy(() => z.object({
  tag: z.string().max(40), attributes: z.record(z.string().max(80), z.string().max(100000)),
  children: z.array(z.union([z.string().max(20000), workspaceSnapshotNodeSchema])).max(5000),
}))
export const workspaceSnapshotSchema = z.object({ nodes: workspaceSnapshotNodeSchema.array().max(5000), truncated: z.boolean(), accountId: z.string().optional() })
export type WorkspaceSnapshot = z.infer<typeof workspaceSnapshotSchema>
const tags = new Set('div section article header footer main aside form p span h1 h2 h3 h4 h5 h6 ul ol li dl dt dd strong em b i small label input textarea select option button a table thead tbody tr th td caption details summary svg g path circle rect line polyline polygon text tspan defs linearGradient radialGradient stop clipPath mask br hr'.split(' '))
const attributes = new Set('class style id role title type value checked disabled readonly selected rows open colspan rowspan width height viewBox d fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset fill-rule clip-rule cx cy r rx ry x y x1 y1 x2 y2 points transform opacity offset stop-color stop-opacity gradientUnits gradientTransform clip-path preserveAspectRatio'.split(' '))
export function snapshotTagAllowed(tag: string) { return tags.has(tag) }
export function snapshotAttributeAllowed(name: string) { return attributes.has(name) || /^(aria-|data-)[a-zA-Z0-9-]+$/.test(name) }
// Only local SVG references are needed. Never restore URLs, handlers, scripts or external resources.
export function safeSnapshotAttribute(name: string, value: string, prefix: string) {
  if (!snapshotAttributeAllowed(name)) return null
  if (name === 'id') return prefix + value
  if (name === 'style') return null // handled as validated React style properties by the renderer
  if (/url\(/i.test(value) && !/^url\(#[\w:-]+\)$/.test(value)) return null
  if (/^url\(#/.test(value)) return value.replace('url(#', 'url(#' + prefix)
  return value
}

export function snapshotVisibleTo(snapshot: WorkspaceSnapshot, accountId?: string) { return !snapshot.accountId || snapshot.accountId === accountId }
