import type { ReactNode } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import type { View } from '@/lib/workspace/config'

export function Brand() {
  return <span className="goal-brand"><Sparkles size={20} /> Orlo</span>
}

export function AppShell({ children }: { view: View; onNavigate: (view: View) => void; children: ReactNode }) {
  const { notice, notify } = useWorkspace()
  return <><main id="main-content" className="shared-page-content" tabIndex={-1}>{children}</main>{notice && <div className="notice-toast" role="status"><span>{notice}</span><button onClick={() => notify('')} aria-label="Dismiss message"><X size={16} /></button></div>}</>
}
