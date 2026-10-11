import { RecordNotice } from '@/components/feedback/RecordNotice'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { defaultLightTheme, ThemeProvider } from '@openuidev/react-ui'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SidebarToggleButton } from './SidebarToggleButton'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { PageHeader } from './PageHeader'
import { PageHeaderContext } from './pageHeaderContext'

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
  const [activeSlots, setActiveSlots] = useState<Set<string>>(() => new Set())
  const register = useCallback((id: string) => {
    setActiveSlots(slots => new Set(slots).add(id))
    return () => setActiveSlots(slots => {
      const next = new Set(slots)
      next.delete(id)
      return next
    })
  }, [])
  const headerSlot = useMemo(() => ({ target: headerActions, register }), [headerActions, register])
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
    <div className="workspace-main-panel"><PageHeader visible={!sidebarOpen || activeSlots.size > 0}
      left={!sidebarOpen && <SidebarToggleButton branded open={false} mobile={mobile} onClick={() => setSidebarOpen(true)} />}
      right={<div ref={setHeaderActions} className="flex flex-wrap items-center justify-end gap-2" />}
    /><PageHeaderContext.Provider value={headerSlot}><Outlet /></PageHeaderContext.Provider></div>
  </div><RecordNotice/></ThemeProvider>
}
