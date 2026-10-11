import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUp, BookOpen, Check, ChevronLeft, ChevronRight, Clock3, FileText, LayoutGrid, ListTodo, PanelLeft, Search, Sparkles, Users, Video } from 'lucide-react'
import { OrloLogo } from '@/components/shell/OrloLogo'

export type PreviewView = 'all' | 'tasks' | 'meetings' | 'notes' | 'resources' | 'planner'
const demoTasks = [
  { title: 'Prepare design review', detail: 'Today · High priority', done: false },
  { title: 'Send project brief', detail: 'Today', done: false },
  { title: 'Review feedback', detail: 'Yesterday', done: true },
  { title: 'Update roadmap', detail: 'Yesterday', done: true },
]
const demoMeetings = [{ title: 'Design review', time: '10:00 – 11:00 AM · Today' }, { title: 'Product sync', time: '2:00 – 2:30 PM · Today' }, { title: 'Team standup', time: '10:00 – 10:15 AM · Tomorrow' }]
const cardStyle = 'rounded-xl border border-[#e7e7ee] bg-white p-4 text-[#30313e]'

export function TaskPreview({ interactive = false, items, onToggle }: { interactive?: boolean; items?: typeof demoTasks; onToggle?: (index: number) => void }) {
  const [localTasks, setLocalTasks] = useState(demoTasks)
  const tasks = items ?? localTasks
  return <div className={cardStyle}><div className="mb-5 flex items-center justify-between text-xs font-medium"><span className="flex items-center gap-2"><ListTodo size={13} />Tasks</span><span className="text-[10px] text-[#9778e7]">{interactive ? 'Demo checklist' : 'Example tasks'}</span></div><div className="space-y-5">{tasks.map((task, index) => <div key={task.title} className="flex items-start gap-2.5">{interactive ? <button type="button" aria-label={`${task.done ? 'Reopen' : 'Complete'} demo task: ${task.title}`} aria-pressed={task.done} onClick={() => { if (onToggle) onToggle(index); else setLocalTasks(items => items.map((item, i) => i === index ? { ...item, done: !item.done } : item)) }} className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] ${task.done ? 'border-[#55a77d] bg-[#55a77d] text-white' : 'border-[#a7a8b3]'}`}>{task.done && <Check size={9} />}</button> : <span className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded-full border ${task.done ? 'border-[#55a77d] bg-[#55a77d] text-white' : 'border-[#a7a8b3]'}`}>{task.done && <Check size={9} />}</span>}<div><p className={`text-xs ${task.done ? 'text-[#999ba8] line-through' : ''}`}>{task.title}</p><p className="mt-1 text-[10px] text-[#a1a2ae]">{task.detail}</p></div></div>)}</div></div>
}
export function MeetingPreview() {
  return <div className={cardStyle}><div className="mb-5 flex items-center justify-between text-xs font-medium"><span className="flex items-center gap-2"><Users size={13} />Upcoming meetings</span><span className="text-[10px] text-[#9778e7]">Demo</span></div><div className="space-y-3">{demoMeetings.map(meeting => <div key={meeting.title} className="flex gap-2 rounded-lg bg-[#f8f7fc] p-2.5"><span className="w-0.5 shrink-0 rounded-full bg-[#a080ef]" /><div className="min-w-0 flex-1"><p className="text-xs">{meeting.title}</p><p className="mt-1 text-[9px] text-[#999ba8]">{meeting.time}</p></div><Video size={11} className="shrink-0 text-[#a080ef]" /></div>)}</div></div>
}
export function CalendarPreview() {
  return <div className={cardStyle}><div className="mb-4 flex items-center justify-between text-xs font-medium"><span>October 2026</span><span className="flex gap-2 text-[#a2a3af]"><ChevronLeft size={11} /><ChevronRight size={11} /></span></div><div className="mb-2 grid grid-cols-7 gap-1 text-center text-[8px] text-[#a2a3af]">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => <span key={i}>{day}</span>)}</div><div className="grid grid-cols-7 gap-1 text-center text-[9px]">{[5, 6, 7, 8, 9, 10, 11].map(day => <span key={day} className={`rounded-md py-1 ${day === 11 ? 'bg-[#9470e9] text-white' : ''}`}>{day}</span>)}</div><div className="mt-5 space-y-3 border-l border-[#eeeef3] pl-3"><div className="flex gap-2"><span className="w-7 text-[8px] text-[#abaebb]">10 AM</span><div className="flex-1 rounded-md bg-[#eee7ff] p-2 text-[9px] text-[#8065c2]">Design review<small className="mt-1 block text-[8px]">10:00 – 11:00 AM</small></div></div><div className="flex gap-2"><span className="w-7 text-[8px] text-[#abaebb]">2 PM</span><div className="flex-1 rounded-md bg-[#f4f0fc] p-2 text-[9px] text-[#8065c2]">Product sync<small className="mt-1 block text-[8px]">2:00 – 2:30 PM</small></div></div></div></div>
}
export function ResourcePreview() {
  return <div className={cardStyle}><p className="mb-4 flex items-center gap-2 text-xs font-medium"><BookOpen size={13} />Resources</p><div className="space-y-4">{['Product brief', 'Design references', 'Research notes'].map((title, i) => <div key={title} className="flex gap-2.5"><span className={`flex size-7 shrink-0 items-center justify-center rounded-md ${i === 1 ? 'bg-[#fff8ec] text-[#c4a366]' : 'bg-[#f3effd] text-[#a080df]'}`}><FileText size={13} /></span><div><p className="text-xs">{title}</p><p className="mt-1 text-[9px] text-[#a1a2ae]">{i === 1 ? 'Reference' : 'Document'} · Demo resource</p></div></div>)}</div></div>
}
function NotesPreview() {
  return <div className={cardStyle}><p className="mb-4 flex items-center gap-2 text-xs font-medium"><FileText size={13} />Meeting preparation</p><p className="text-sm font-medium">A little clarity before the call.</p><ol className="mt-4 space-y-3 text-xs text-[#9293a2]"><li>1. Review the latest designs</li><li>2. Bring the open questions</li><li>3. Agree on the next steps</li></ol><div className="mt-5 h-1.5 w-3/4 rounded-full bg-[#f1edf8]" /></div>
}
const navItems = [{ view: 'all', name: 'Workspace', icon: LayoutGrid }, { view: 'tasks', name: 'Tasks', icon: ListTodo }, { view: 'meetings', name: 'Meetings', icon: Users }, { view: 'notes', name: 'Notes', icon: FileText }, { view: 'resources', name: 'Resources', icon: BookOpen }, { view: 'planner', name: 'Planner', icon: Clock3 }] as const
export type PreviewHandle = { play: () => void }
export function WorkspacePreview({ ref }: { ref?: Ref<PreviewHandle> }) {
  const [view, setView] = useState<PreviewView>('all')
  const [taskValues, setTaskValues] = useState(demoTasks)
  const [composing, setComposing] = useState(false)
  const reducedMotion = useReducedMotion()
  const timer = useRef<number | null>(null)
  const runDemo = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setView('tasks'); setComposing(true)
    timer.current = window.setTimeout(() => { setView('all'); setComposing(false); timer.current = null }, reducedMotion ? 250 : 1100)
  }, [reducedMotion])
  useImperativeHandle(ref, () => ({ play: runDemo }), [runDemo])
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const primary = view === 'meetings' ? <MeetingPreview /> : view === 'resources' ? <ResourcePreview /> : view === 'notes' ? <NotesPreview /> : view === 'planner' ? <CalendarPreview /> : <TaskPreview interactive items={taskValues} onToggle={index => setTaskValues(items => items.map((item, i) => i === index ? { ...item, done: !item.done } : item))} />
  return <div className="overflow-hidden rounded-[22px] border border-white/25 bg-white shadow-[0_0_0_5px_rgba(255,255,255,.035),0_32px_100px_-35px_rgba(0,0,0,.7)]" aria-label="Interactive demo workspace">
    <div className="grid text-[#343540] sm:grid-cols-[156px_1fr] lg:grid-cols-[190px_1fr]">
      <aside className="hidden border-r border-[#eeeef3] bg-[#faf9fd] p-4 sm:block"><div className="mb-6 flex items-center gap-2 text-sm font-semibold"><OrloLogo size={21} />Orlo</div><div className="space-y-1">{navItems.map(({ view: item, name, icon: Icon }) => <button key={item} type="button" onClick={() => setView(item)} aria-pressed={view === item} className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] ${view === item ? 'bg-[#ede6fb] text-[#9874e3]' : 'text-[#878894] hover:bg-[#f1edf8]'}`}><Icon size={13} />{name}</button>)}</div><p className="mt-16 text-[9px] leading-4 text-[#a8a8b5]">Example workspace.<br />Your actual records stay untouched.</p></aside>
      <div className="min-w-0 p-4 md:p-6"><div className="mb-5 flex items-center justify-between"><span className="text-[11px] font-medium">Demo workspace</span><div className="flex items-center gap-3"><span className="flex items-center gap-1.5 rounded-full border border-[#eeedf4] px-2 py-1 text-[9px] text-[#9293a0]"><span className="size-1.5 rounded-full bg-[#61a785]" />Demo data</span><Search size={12} className="text-[#9597a3]" /><span className="flex size-6 items-center justify-center rounded-full bg-[#eeeef4] text-[9px] text-[#8a8c9b]">JD</span></div></div>
        <button type="button" onClick={runDemo} className="mb-4 flex w-full items-center gap-3 rounded-xl border border-[#e4d8fd] bg-[#fdfbff] p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]" aria-label="Run example prompt"><Sparkles size={15} className="shrink-0 text-[#a285e7]" /><span className="min-w-0 flex-1 text-[11px] md:text-xs">{composing ? 'Demo: adding meetings beside your tasks…' : 'Show my pending tasks and meetings'}</span><kbd className="hidden rounded-md border border-[#eeedf4] px-2 py-1 text-[9px] text-[#a6a3b4] md:block">Ctrl + K</kbd><span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#aa8bee] text-white"><ArrowUp size={13} /></span></button>
        <div className="mb-5 flex flex-wrap gap-1.5" aria-label="Demo views">{navItems.slice(0, 5).map(item => <button key={item.view} type="button" onClick={() => setView(item.view)} aria-pressed={view === item.view} className={`rounded-full px-3 py-1.5 text-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa] ${view === item.view ? 'bg-[#9b78e7] text-white' : 'bg-[#f5f4f8] text-[#9896a5]'}`}>{item.view === 'all' ? 'All' : item.name}</button>)}</div>
        <div className="grid min-h-[260px] gap-3 md:grid-cols-3"><div className={view !== 'all' ? 'md:col-span-2' : ''}>{primary}</div><AnimatePresence>{view === 'all' && <motion.div key="meeting" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.3 }}><MeetingPreview /></motion.div>}</AnimatePresence><div className="hidden md:block">{view === 'all' ? <CalendarPreview /> : <div className="flex h-full min-h-56 flex-col justify-center rounded-xl border border-dashed border-[#e9e4f3] bg-[#faf8fd] p-5 text-[#a3a0ae]"><PanelLeft size={18} className="mb-3 text-[#bda9e7]" /><p className="text-sm font-medium text-[#797181]">A view shaped around you.</p><p className="mt-2 text-[11px] leading-5">Choose a view or run the example prompt. This preview uses demo data only.</p></div>}</div></div>
      </div>
    </div>
  </div>
}
