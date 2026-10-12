import { extensionForWidget } from './catalog'
import { extensionService } from '@/services'
import { extensionCatalog } from './catalog'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'
export function DisabledExtension({ id, remove }: { id: string; remove?: () => void }) {
  const { notify } = useWorkspace(), extensionId = extensionForWidget(id)!, definition = extensionCatalog.find(item => item.id === extensionId)!
  return <div className="space-y-3"><p className="text-sm text-muted-foreground">{definition.title} is disabled.</p><div className="flex flex-wrap gap-2">{!['external-plugin', 'voice-note'].includes(id) && <Button size="sm" variant="outline" onClick={async () => { const result = await extensionService.setEnabled(extensionId, true); if (!result.ok) notify(result.message) }}>Enable extension</Button>}{remove && <Button size="sm" variant="ghost" onClick={remove}>Remove from layout</Button>}</div></div>
}
