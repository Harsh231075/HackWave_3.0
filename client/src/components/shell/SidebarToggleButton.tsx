import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { OrloLogo } from './OrloLogo'
import { SidebarToggleIcon } from './SidebarToggleIcon'

export function SidebarToggleButton({ open, onClick, branded = false, mobile = false }: {
  open: boolean
  onClick: () => void
  branded?: boolean
  mobile?: boolean
}) {
  const label = open ? mobile ? 'Close sidebar' : 'Hide sidebar' : 'Open sidebar'
  return <TooltipProvider delay={250}><Tooltip><TooltipTrigger render={<Button
    variant="ghost"
    size={branded ? 'default' : 'icon'}
    className={branded ? 'sidebar-brand-toggle' : 'sidebar-toggle-button'}
    aria-label={label}
    aria-expanded={open}
    aria-controls="workspace-sidebar"
    onClick={onClick}
  />}>
    {branded ? <><span className="sidebar-brand-symbol"><span className="sidebar-brand-logo"><OrloLogo size={28} /></span><span className="sidebar-brand-panel"><SidebarToggleIcon open={open} /></span></span><span>Orlo</span></> : mobile ? <X size={24} className="size-6" aria-hidden="true" /> : <SidebarToggleIcon open={open} />}
  </TooltipTrigger><TooltipContent side="bottom">{label}</TooltipContent></Tooltip></TooltipProvider>
}
