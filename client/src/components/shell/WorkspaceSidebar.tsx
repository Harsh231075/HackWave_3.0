import { NavLink } from 'react-router-dom'
import { CalendarDays, Clock3, Home, LayoutGrid, ListTodo, PanelLeftClose, Sparkles, Target, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'

const pages = [
  { to: '/', label: 'Workspace', icon: Sparkles },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/meetings', label: 'Meetings', icon: Users },
  { to: '/planner', label: 'Planner', icon: Clock3 },
  { to: '/priorities', label: 'Priorities', icon: Target },
]

export function WorkspaceSidebar({ onClose }: { onClose: () => void }) {
  return <div className="workspace-sidebar-content"><div className="workspace-sidebar-heading"><span className="goal-brand"><Sparkles size={20} /> GoGPT</span><Button variant="ghost" size="icon" onClick={onClose} aria-label="Hide sidebar"><PanelLeftClose size={19} /></Button></div>
    <nav aria-label="Workspace pages">{pages.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={() => { if (window.matchMedia('(max-width: 767px)').matches) onClose() }} className={({ isActive }) => `workspace-page-link${isActive ? ' active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
    <div className="workspace-sidebar-bottom"><NavLink to="/landing" onClick={onClose} className="workspace-page-link"><Home size={18} />About GoGPT</NavLink>{import.meta.env.DEV && <NavLink to="/dev/components" onClick={onClose} className="workspace-page-link"><LayoutGrid size={18} />Component gallery</NavLink>}</div>
  </div>
}
