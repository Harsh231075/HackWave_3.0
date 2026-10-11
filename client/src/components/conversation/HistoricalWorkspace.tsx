import { createElement, type CSSProperties, type ReactNode } from 'react'
import { safeSnapshotAttribute, snapshotTagAllowed, snapshotVisibleTo, type WorkspaceSnapshot, type WorkspaceSnapshotNode } from '@/domain/workspaceSnapshot'
const names: Record<string, string> = { class: 'className', readonly: 'readOnly', colspan: 'colSpan', rowspan: 'rowSpan', 'stroke-width': 'strokeWidth', 'stroke-linecap': 'strokeLinecap', 'stroke-linejoin': 'strokeLinejoin', 'stroke-dasharray': 'strokeDasharray', 'stroke-dashoffset': 'strokeDashoffset', 'fill-rule': 'fillRule', 'clip-rule': 'clipRule', 'clip-path': 'clipPath', 'stop-color': 'stopColor', 'stop-opacity': 'stopOpacity' }
function safeStyle(value: string): CSSProperties {
  const style: Record<string, string> = {}
  for (const declaration of value.split(';')) {
    const split = declaration.indexOf(':'); if (split < 0) continue
    const name = declaration.slice(0, split).trim(), text = declaration.slice(split + 1).trim()
    if (!/^--[\w-]+$|^[a-z-]+$/.test(name) || /url\(|expression|javascript|behavior|position\s*:/i.test(text) || name === 'position') continue
    style[name.startsWith('--') ? name : name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())] = text
  }
  style.animation = 'none'
  return style
}
export function HistoricalWorkspace({ snapshot, turnId, accountId }: { snapshot: WorkspaceSnapshot; turnId: string; accountId?: string }) {
  if (!snapshotVisibleTo(snapshot, accountId)) return <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">This previous calendar response belongs to another account. Connect the original account to view it.</p>
  const prefix = 'history-' + turnId + '-'
  function render(node: WorkspaceSnapshotNode | string, key: string): ReactNode {
    if (typeof node === 'string') return node
    if (!snapshotTagAllowed(node.tag)) return null
    const props: Record<string, unknown> = { key }
    for (const [name, value] of Object.entries(node.attributes)) {
      if (name === 'selected') continue // the frozen select value owns selection
      if (name === 'style') { props.style = safeStyle(value); continue }
      const allowed = safeSnapshotAttribute(name, value, prefix)
      if (allowed !== null) props[names[name] ?? name] = ['checked', 'disabled', 'readonly', 'open'].includes(name) ? true : allowed
    }
    if (['input', 'textarea', 'select', 'button'].includes(node.tag)) props.disabled = true
    // The snapshot is visual history, so anchors have no navigation behavior.
    const tag = node.tag === 'a' ? 'span' : node.tag === 'form' ? 'div' : node.tag
    if (tag === 'input' || tag === 'br' || tag === 'hr') return createElement(tag, props)
    if (tag === 'textarea') return createElement(tag, { ...props, readOnly: true })
    return createElement(tag, props, ...node.children.map((child, index) => render(child, key + '-' + index)))
  }
  return <section className="space-y-3" aria-label="Previous workspace response" data-history-turn={turnId}>
    <p className="text-xs font-medium text-muted-foreground">Previous response · read-only snapshot</p>
    <div inert className="pointer-events-none select-none [&_*]:animate-none" data-workspace-snapshot>{snapshot.nodes.map((node, index) => render(node, String(index)))}</div>
    {snapshot.truncated && <p className="text-xs text-muted-foreground">This preview has been shortened to keep conversation history responsive.</p>}
  </section>
}
