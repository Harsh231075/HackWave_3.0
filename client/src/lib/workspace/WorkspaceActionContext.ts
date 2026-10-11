import { createContext, useContext } from 'react'
import type { ActionOrigin } from '@/domain/workspaceActions'
export const WorkspaceActionContext = createContext<{ revision: number; pending: boolean; dispatch: (value: unknown, origin: ActionOrigin) => void } | null>(null)
export const ActionOriginContext = createContext<ActionOrigin | null>(null)
export function useWorkspaceActions() {
  const host = useContext(WorkspaceActionContext)
  const origin = useContext(ActionOriginContext)
  return host && origin ? { pending: host.pending, dispatch: (value: unknown) => host.dispatch(value, origin) } : null
}
