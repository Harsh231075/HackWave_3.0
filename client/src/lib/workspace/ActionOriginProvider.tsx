import type { ReactNode } from 'react'
import type { ActionOrigin } from '@/domain/workspaceActions'
import { ActionOriginContext } from './WorkspaceActionContext'
export function ActionOriginProvider({ origin, children }: { origin: ActionOrigin; children: ReactNode }) {
  return <ActionOriginContext.Provider value={origin}>{children}</ActionOriginContext.Provider>
}
