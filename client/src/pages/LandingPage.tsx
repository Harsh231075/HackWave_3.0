import { Link } from 'react-router-dom'
import { Brand } from '@/components/shell/AppShell'
import { ArrowRight, ArrowUpRight, CalendarDays, Check, Command, ListTodo, PanelLeft, Plus } from 'lucide-react'

const previewTasks = [
  { title: 'Outline the next project', detail: 'Today', done: true },
  { title: 'Make time for focused work', detail: 'Today', done: false },
  { title: 'Prepare for the team catch-up', detail: 'Tomorrow', done: false },
]

const features = [
  { title: 'Plan your day.', text: 'Bring tasks and time into one clear view.' },
  { title: 'Keep everything together.', text: 'Your priorities, plans, and next steps, in one place.' },
  { title: 'Change your workspace.', text: 'Describe what you need. Orlo shapes the layout.' },
]

function WorkspacePreview() {
  return <section className="landing-preview" aria-label="Example Orlo workspace">
    <div className="landing-preview-bar"><span className="landing-preview-brand"><PanelLeft size={18} aria-hidden="true" /> Your workspace</span><span className="landing-preview-shortcut"><Command size={14} aria-hidden="true" /> Ctrl K</span></div>
    <div className="landing-preview-content">
      <div className="landing-preview-tasks"><div className="landing-preview-heading"><h2><ListTodo size={17} aria-hidden="true" /> Tasks</h2><span className="landing-preview-add"><Plus size={13} aria-hidden="true" /> New task</span></div>
        {previewTasks.map(task => <div className={`landing-preview-task${task.done ? ' is-done' : ''}`} key={task.title}><span className="landing-preview-check" aria-hidden="true">{task.done && <Check size={12} />}</span><span>{task.title}<small>{task.detail}</small></span></div>)}
      </div>
      <div className="landing-preview-calendar"><div className="landing-preview-heading"><h2><CalendarDays size={17} aria-hidden="true" /> Calendar</h2><span>Monday, Oct 12</span></div><div className="landing-preview-event"><time>09:00</time><div><strong>Focus time</strong><span>A little space for your next idea.</span></div></div><div className="landing-preview-event"><time>13:30</time><div><strong>Team catch-up</strong><span>30 minutes to get on the same page.</span></div></div></div>
      <div className="landing-preview-command"><span className="landing-preview-command-icon"><Command size={17} aria-hidden="true" /></span><span>Build a workspace for my week</span><span className="landing-preview-command-key">↵</span></div>
    </div>
  </section>
}

export function LandingPage() {
  return <div className="landing-page">
    <nav className="landing-nav" aria-label="Main navigation"><Link to="/landing" aria-label="Orlo home"><Brand logoSize={28} /></Link><Link to="/" className="landing-nav-link">Open workspace <ArrowUpRight size={16} aria-hidden="true" /></Link></nav>
    <main>
      <section className="landing-hero"><h1>Make space for<br />what matters.</h1><p>Plan tasks, organize your calendar, and shape your workspace with a few words.</p><Link to="/" className="landing-cta">Open workspace <ArrowRight size={17} aria-hidden="true" /></Link></section>
      <WorkspacePreview />
      <section className="landing-features" aria-label="What you can do with Orlo">{features.map(feature => <div key={feature.title}><h2>{feature.title}</h2><p>{feature.text}</p></div>)}</section>
    </main>
    <footer className="landing-footer"><Brand logoSize={20} /><p>A workspace shaped by your goal.</p></footer>
  </div>
}
