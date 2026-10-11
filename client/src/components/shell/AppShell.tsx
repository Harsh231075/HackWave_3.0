import type { ReactNode } from 'react'
import { OrloLogo } from './OrloLogo'
import type { View } from '@/lib/workspace/config'

export function Brand({ logoSize = 26 }: { logoSize?: number }) {
  return <span className="goal-brand"><OrloLogo size={logoSize} /> Orlo</span>
}

export function AppShell({ children }: { view: View; onNavigate: (view: View) => void; children: ReactNode }) {
  return <main id="main-content" className="shared-page-content" tabIndex={-1}>{children}</main>
}
