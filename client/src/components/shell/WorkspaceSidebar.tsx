import { ProjectControls, LocalDataSettings } from '@/components/records/ProjectControls'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { BookOpen, FileText, Clock3, Home, LayoutDashboard, LayoutGrid, ListTodo, Settings, Users } from 'lucide-react'
import { SidebarToggleButton } from './SidebarToggleButton'
import { Brand } from './AppShell'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'

const pages = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/meetings', label: 'Meetings', icon: Users },
  { to: '/notes', label: 'Notes', icon: FileText },
  { to: '/resources', label: 'Resources', icon: BookOpen },
  { to: '/planner', label: 'Planner', icon: Clock3 },
]

export function WorkspaceSidebar({ onClose, mobile = false }: { onClose: () => void; mobile?: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="workspace-sidebar-content">
        <div className="workspace-sidebar-heading">
          {!mobile && <Brand />}
          <div className="ml-auto">
            <SidebarToggleButton open mobile={mobile} onClick={onClose} />
          </div>
        </div>
        <ProjectControls /><nav aria-label="Workspace pages">
          {pages.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={() => {
                if (window.matchMedia('(max-width: 767px)').matches) onClose()
              }}
              className={({ isActive }) => `workspace-page-link${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="workspace-sidebar-bottom">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="workspace-page-link w-full text-left"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <NavLink to="/landing" onClick={onClose} className="workspace-page-link">
            <Home size={18} />
            <span>About Orlo</span>
          </NavLink>
          {import.meta.env.DEV && (
            <NavLink to="/dev/components" onClick={onClose} className="workspace-page-link">
              <LayoutGrid size={18} />
              <span>Component gallery</span>
            </NavLink>
          )}
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage local data and calendar connections.
            </DialogDescription>
          </DialogHeader>
          <GoogleCalendarConnection /><LocalDataSettings />
        </DialogContent>
      </Dialog>
    </>
  )
}

