import type { z } from 'zod'
import type { workspaceActionButtonSchema } from '@/domain/workspaceActions'
import { useWorkspaceActions } from './WorkspaceActionContext'
import { Button } from '@/components/ui/button'
export function GeneratedActionButtons({ buttons }: { buttons: z.infer<typeof workspaceActionButtonSchema>[] }) {
  const actions = useWorkspaceActions()
  return <div className="mt-3 flex flex-wrap gap-2">{buttons.map((button, index) => <Button key={index} variant="outline" disabled={!actions || actions.pending} onClick={() => actions?.dispatch(button.action)}>{button.label}</Button>)}</div>
}
