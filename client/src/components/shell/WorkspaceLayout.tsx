import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { defaultLightTheme, ThemeProvider } from '@openuidev/react-ui'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Brand } from './AppShell'
import { SidebarToggleIcon } from './SidebarToggleIcon'
import { WorkspaceSidebar } from './WorkspaceSidebar'

const fontTheme = {
  // OpenUI text tokens embed their font family in font shorthands.
  ...Object.fromEntries(Object.entries(defaultLightTheme)
    .filter(([key, value]) => key.startsWith('text') && typeof value === 'string' && (value.includes(defaultLightTheme.fontBody!) || value.includes(defaultLightTheme.fontCode!)))
    .map(([key, value]) => [key, (value as string).replace(defaultLightTheme.fontBody!, 'Figtree, sans-serif').replace(defaultLightTheme.fontCode!, 'Figtree, sans-serif')])),
  fontBody: 'Figtree, sans-serif',
  fontHeading: 'Figtree, sans-serif',
  fontLabel: 'Figtree, sans-serif',
  fontNumbers: 'Figtree, sans-serif',
  fontCode: 'Figtree, sans-serif',
}

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
  return <ThemeProvider mode="light" lightTheme={fontTheme}><div className="goal-workspace workspace-with-sidebar">
    {sidebarOpen && !mobile && <aside id="workspace-sidebar" className="workspace-sidebar"><WorkspaceSidebar onClose={() => setSidebarOpen(false)} /></aside>}
    {mobile && <Dialog open={sidebarOpen} onOpenChange={setSidebarOpen}><DialogContent id="workspace-sidebar" className="workspace-sidebar-drawer" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Workspace navigation</DialogTitle><DialogDescription className="sr-only">Navigate between workspace pages.</DialogDescription></DialogHeader><WorkspaceSidebar mobile onClose={() => setSidebarOpen(false)} /></DialogContent></Dialog>}
    <div className="workspace-main-panel"><header className="canvas-header">{(mobile || !sidebarOpen) && <div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label="Open sidebar" aria-expanded={sidebarOpen} aria-controls="workspace-sidebar" onClick={() => setSidebarOpen(true)}><SidebarToggleIcon open={sidebarOpen} /></Button><Brand /></div>}<div ref={setHeaderActions} className="ml-auto flex items-center gap-2" /></header><Outlet context={{ headerActions }} /></div>
  </div></ThemeProvider>
}
