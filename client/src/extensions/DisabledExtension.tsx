import { extensionService } from '@/services'
import { extensionCatalog } from './catalog'
import type { ExtensionId } from './contracts'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'
export function DisabledExtension({ id, remove }: { id: ExtensionId; remove?: () => void }) {
  const { notify } = useWorkspace(), definition = extensionCatalog.find(item => item.id === id)!
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{definition.title} is disabled.</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { const result = extensionService.setEnabled(id, true); if (!result.ok) notify(result.message) }}>Enable extension</Button>{remove && <Button size="sm" variant="ghost" onClick={remove}>Remove from layout</Button>}</div></div>
}
