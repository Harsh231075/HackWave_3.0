import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { PanelLeftOpen, Sparkles } from 'lucide-react'
import { ThemeProvider } from '@openuidev/react-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { WorkspaceSidebar } from './WorkspaceSidebar'

export function WorkspaceLayout() {
  const [headerActions, setHeaderActions] = useState<HTMLDivElement | null>(null)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches)
  const [sidebarOpen, setSidebarOpen] = useState(() => !window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    document.documentElement.classList.remove('dark')
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => { setMobile(media.matches); setSidebarOpen(!media.matches) }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return <ThemeProvider mode="light"><div className="goal-workspace workspace-with-sidebar">
    {sidebarOpen && !mobile && <aside id="workspace-sidebar" className="workspace-sidebar"><WorkspaceSidebar onClose={() => setSidebarOpen(false)} /></aside>}
    {mobile && <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}><DialogContent id="workspace-sidebar" className="workspace-sidebar-drawer" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Workspace navigation</DialogTitle><DialogDescription className="sr-only">Navigate between workspace pages.</DialogDescription></DialogHeader><WorkspaceSidebar onClose={() => setSidebarOpen(false)} /></DialogContent></Dialog>}
    <div className="workspace-main-panel"><header className="canvas-header"><Button variant="ghost" size="icon" aria-label={sidebarOpen ? 'Hide sidebar' : 'Open sidebar'} aria-expanded={sidebarOpen} aria-controls="workspace-sidebar" onClick={() => setSidebarOpen(value => !value)}><PanelLeftOpen size={20} /></Button><span className="goal-brand"><Sparkles size={20} /> Orlo</span><div ref={setHeaderActions} className="ml-auto flex items-center gap-2" /></header><Outlet context={{ headerActions }} /></div>
  </div></ThemeProvider>
}
