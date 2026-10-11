import { snapshotTagAllowed, snapshotAttributeAllowed, type WorkspaceSnapshot, type WorkspaceSnapshotNode } from '@/domain/workspaceSnapshot'
export function captureWorkspaceSnapshot(root: Element): WorkspaceSnapshot {
  let count = 0, truncated = false
  function capture(node: Node, depth: number): WorkspaceSnapshotNode | string | null {
    if (++count > 5000 || depth > 40) { truncated = true; return null }
    if (node.nodeType === 3) return (node.textContent ?? '').slice(0, 20000)
    if (node.nodeType !== 1) return null
    const element = node as Element
    const tag = element.localName
    if (!snapshotTagAllowed(tag)) return null
    const props: Record<string, string> = {}
    for (const attribute of Array.from(element.attributes)) if (snapshotAttributeAllowed(attribute.name)) props[attribute.name] = attribute.value
    if (tag === 'input' || tag === 'textarea' || tag === 'select') props.value = (element as HTMLInputElement).value
    if (tag === 'input') {
      if ((element as HTMLInputElement).type === 'password') props.value = ''
      if ((element as HTMLInputElement).checked) props.checked = ''
    }
    if (tag === 'textarea') return { tag, attributes: props, children: [] }
    return { tag, attributes: props, children: Array.from(element.childNodes).map(child => capture(child, depth + 1)).filter((child): child is WorkspaceSnapshotNode | string => child !== null) }
  }
  return { nodes: Array.from(root.children).map(child => capture(child, 0)).filter((child): child is WorkspaceSnapshotNode => !!child && typeof child !== 'string'), truncated }
}
