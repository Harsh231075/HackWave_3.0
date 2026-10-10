import { PanelLeft } from 'lucide-react'

export function SidebarToggleIcon({ open = false }: { open?: boolean }) {
  return <PanelLeft size={20} aria-hidden="true">{open && <path d="M5 4H9V20H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="currentColor" stroke="none" />}</PanelLeft>
}
