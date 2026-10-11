import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, BookOpen, CalendarDays, Check, ChevronRight, Command, FileText, LayoutGrid, ListChecks, ListTodo, Menu, MessageSquare, Play, Sparkles, Users, X } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { CalendarPreview, MeetingPreview, ResourcePreview, TaskPreview, WorkspacePreview, type PreviewHandle } from '@/components/landing/LandingPreview'

const landscape = '/images/orlo-landing-landscape.png'
const landingLinks = [{ id: 'home', label: 'Home' }, { id: 'features', label: 'Features' }, { id: 'how-it-works', label: 'How it works' }, { id: 'demo', label: 'Demo' }] as const
const capabilities = [
  { name: 'Tasks', icon: ListChecks, text: 'Turn priorities into actionable work.' },
  { name: 'Meetings', icon: Users, text: 'Bring the right conversations into view.' },
  { name: 'Calendar', icon: CalendarDays, text: 'See your day and make space for what matters.' },
  { name: 'Notes', icon: FileText, text: 'Capture and refine your thinking.' },
  { name: 'Resources', icon: BookOpen, text: 'Keep the information you need close by.' },
]
const steps = [
  { title: 'Your prompt', icon: MessageSquare, text: 'Tell Orlo what you need, in plain language.' },
  { title: 'AI interpretation', icon: Sparkles, text: 'Find the relevant tools and available context.' },
  { title: 'Validated plan', icon: ListChecks, text: 'Check components, filters and workspace changes.' },
  { title: 'Your workspace', icon: LayoutGrid, text: 'Bring interactive tools together, ready for you.' },
]
const featureCards = [
  { title: 'Manage your tasks', text: 'Prioritize work, update details and keep your next steps in focus.', preview: TaskPreview },
  { title: 'Prepare for meetings', text: 'Bring meetings, notes and resources together before the conversation.', preview: MeetingPreview },
  { title: 'Keep resources close', text: 'Save references, create resources and connect them to your work.', preview: ResourcePreview },
  { title: 'Plan your day', text: 'See commitments and make room for focused work around them.', preview: CalendarPreview },
]
const linkClass = 'rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary'
function Wordmark() { return <span className="flex items-center gap-2.5 text-xl font-medium tracking-tight"><OrloLogo size={27} />Orlo</span> }
function SectionHeading({ label, title, children }: { label: string; title: string; children?: ReactNode }) {
  return <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14"><p className="mb-4 text-[10px] font-medium uppercase tracking-[0.24em] text-primary">{label}</p><h2 className="text-[clamp(1.9rem,3.5vw,3.25rem)] font-medium leading-[1.12] tracking-[-0.045em] text-foreground">{title}</h2>{children && <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{children}</p>}</div>
}
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reducedMotion = useReducedMotion()
  return <motion.div initial={reducedMotion ? false : { opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.1 }} transition={{ duration: reducedMotion ? 0 : 0.55 }} className={className}>{children}</motion.div>
}
function ContextPreview({ step }: { step: number }) {
  return <div aria-hidden="true" className="mt-5 grid min-h-[140px] grid-cols-2 gap-2 rounded-xl border border-border bg-[#f9f8fc] p-3 text-[#51515e]"><div className="rounded-lg border border-[#e7e3ef] bg-white p-2"><p className="mb-3 flex items-center gap-1.5 text-[9px]"><ListTodo size={10} />Tasks</p>{['Prepare review', 'Send brief'].map(title => <div key={title} className="mb-2 flex items-start gap-1.5 text-[8px]"><span className="mt-0.5 size-2 shrink-0 rounded-full border border-[#b1a9c3]" />{title}</div>)}<div className="mt-3 flex items-center gap-1 text-[7px] text-[#80a38b]"><Check size={9} />Your edits stay</div></div><div className="space-y-2">{step > 0 && <div className="rounded-lg border border-[#e7e3ef] bg-white p-2"><p className="mb-2 flex items-center gap-1.5 text-[9px]"><CalendarDays size={10} />Meetings</p><div className="rounded border-l-2 border-[#a48bcf] bg-[#f4effc] p-1.5 text-[8px]">Design review</div></div>}{step < 2 && <div className="rounded-lg border border-[#e7e3ef] bg-white p-2"><p className="flex items-center gap-1 text-[9px]"><Sparkles size={10} />Suggestions</p><div className="mt-2 h-1 w-3/4 rounded bg-[#eee8f7]" /></div>}</div></div>
}

export function LandingPage() {
  const [mobileMenu, setMobileMenu] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const demo = useRef<PreviewHandle>(null)
  const reducedMotion = useReducedMotion()
  const navigate = useNavigate()
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); navigate('/', { state: { openCommand: true } }) }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [navigate])
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) setActiveSection(visible[0].target.id)
    }, { rootMargin: '-5% 0px -65% 0px', threshold: 0 })
    landingLinks.forEach(({ id }) => { const section = document.getElementById(id); if (section) observer.observe(section) })
    return () => observer.disconnect()
  }, [])
  function scrollToSection(id: string) {
    setActiveSection(id); setMobileMenu(false)
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' })
  }
  function navigateSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    window.history.replaceState(window.history.state, '', `#${id}`)
    scrollToSection(id)
  }
  function watchDemo() { demo.current?.play(); scrollToSection('demo') }
  return <div className="relative isolate min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary/15">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(1050px,100%)]" aria-hidden="true"><img src={landscape} alt="" fetchPriority="high" className="h-full w-full object-cover object-[center_65%] opacity-75 brightness-125 saturate-75" /><div className="absolute inset-0 bg-linear-to-b from-white/35 via-[#f3effc]/55 to-white" /><div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#ffffff_5%,transparent_65%)]" /></div>
    <a href="#landing-main" className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-black focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Skip to content</a>
    <header className="fixed left-1/2 top-6 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 max-w-[1040px] items-center justify-between gap-3 rounded-full border border-primary/10 bg-[#f0eef6]/90 py-2 pl-5 pr-2 shadow-sm backdrop-blur-xl sm:w-[calc(100%-4rem)] sm:gap-5 sm:pl-6">
      <Link to="/landing" aria-label="Orlo home" className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-primary"><Wordmark /></Link>
      <nav aria-label="Landing navigation" className="hidden items-center gap-1 lg:flex">
        {landingLinks.map(({ id, label }) => <a key={id} href={`#${id}`} onClick={event => navigateSection(event, id)} aria-current={activeSection === id ? 'location' : undefined} className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:px-5 ${activeSection === id ? 'border-primary/15 bg-white text-primary shadow-sm' : 'border-transparent text-muted-foreground hover:bg-white/60 hover:text-foreground'}`}>{label}</a>)}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <Link to="/" aria-label="Open workspace" className={`${linkClass} flex items-center gap-2 px-4 py-2.5 text-xs`}>Open<span className="hidden sm:inline">workspace</span><ArrowRight size={14} /></Link>
        <button type="button" aria-label={mobileMenu ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileMenu} aria-controls="landing-mobile-nav" onClick={() => setMobileMenu(value => !value)} className="rounded-full border border-border bg-white/60 p-2 text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary lg:hidden">{mobileMenu ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      {mobileMenu && <nav id="landing-mobile-nav" aria-label="Mobile landing navigation" className="absolute inset-x-0 top-[calc(100%+0.75rem)] z-30 space-y-1 rounded-3xl border border-border bg-popover p-2 shadow-lg lg:hidden">
        {landingLinks.map(({ id, label }) => <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={event => navigateSection(event, id)} className={`block rounded-full px-4 py-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${activeSection === id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'}`}>{label}</a>)}
      </nav>}
    </header>
    <main id="landing-main">
    <div className="relative isolate">

      <div>
        <section id="home" className="mx-auto scroll-mt-28 flex max-w-5xl flex-col items-center px-5 pb-14 pt-40 text-center md:pb-20 md:pt-44" aria-labelledby="hero-title"><Reveal><span className="inline-flex rounded-full border border-primary/15 bg-primary/5 px-4 py-1.5 text-[10px] tracking-wide text-primary">AI-powered adaptive workspace</span><h1 id="hero-title" className="mt-7 text-[clamp(3.4rem,7.6vw,7.2rem)] font-medium leading-[0.98] tracking-[-0.065em]">Your intent.<br />Your workspace.</h1><p className="mx-auto mt-7 max-w-lg text-sm leading-7 text-muted-foreground md:text-base">Tell Orlo what you need.<br className="sm:hidden" /> Bring the right tools into view.</p><div className="mt-7 flex flex-wrap items-center justify-center gap-5"><Link to="/" className={`${linkClass} flex items-center gap-4`}>Open workspace <ArrowRight size={16} /></Link><button type="button" onClick={watchDemo} className="flex items-center gap-2.5 rounded-full px-2 py-3 text-xs text-foreground transition hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"><span className="flex size-7 items-center justify-center rounded-full border border-border"><Play size={10} fill="currentColor" /></span>Watch the demo</button></div><div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground"><kbd className="rounded border border-border bg-muted px-1.5 py-1">Ctrl</kbd><span>+</span><kbd className="rounded border border-border bg-muted px-1.5 py-1">K</kbd><span className="ml-1">to open Orlo</span></div></Reveal></section>
        <section id="demo" aria-label="Try an example workspace" className="mx-auto max-w-[1200px] scroll-mt-28 px-4 md:px-8"><Reveal><WorkspacePreview ref={demo} /></Reveal><p className="mt-5 text-center text-[11px] text-muted-foreground">An interactive preview with demo data. Your workspace stays untouched.</p></section>
        <section aria-label="Tools in your workspace" className="mx-auto grid max-w-[1200px] grid-cols-2 gap-8 px-7 py-14 sm:grid-cols-3 md:grid-cols-5 md:gap-0 md:py-20">{capabilities.map(({ name, icon: Icon, text }, index) => <div key={name} className={`text-center ${index > 0 ? 'md:border-l md:border-border' : ''}`}><Icon size={28} strokeWidth={1.4} className="mx-auto mb-4 text-primary" /><h2 className="text-sm font-medium">{name}</h2><p className="mx-auto mt-2 max-w-36 text-xs leading-5 text-muted-foreground">{text}</p></div>)}</section>
      </div>
    </div>
    <section id="how-it-works" className="relative scroll-mt-28 border-y border-border px-5 py-16 md:px-8 md:py-24" aria-label="How Orlo works"><div className="mx-auto max-w-[1150px]"><SectionHeading label="How it works" title="From intent to interface.">Express a goal. Orlo selects the tools and shapes a workspace you can use.</SectionHeading><div className="relative grid gap-5 md:grid-cols-4"><div aria-hidden="true" className="absolute inset-x-16 top-1/2 hidden h-px bg-linear-to-r from-transparent via-primary/25 to-transparent md:block" />{steps.map(({ title, icon: Icon, text }, index) => <Reveal key={title} className="relative"><div className="relative h-full rounded-2xl border border-border bg-card shadow-sm p-5 text-center"><span className="absolute left-4 top-4 flex size-6 items-center justify-center rounded-full border border-border bg-muted text-[10px] text-muted-foreground">{index + 1}</span><Icon size={27} strokeWidth={1.4} className="mx-auto mb-4 mt-6 text-primary" /><h3 className="text-sm font-medium">{title}</h3><p className="mx-auto mt-3 max-w-40 text-xs leading-5 text-muted-foreground">{text}</p>{index < 3 && <span aria-hidden="true" className="absolute -right-4 top-1/2 z-10 hidden text-primary md:block"><ArrowRight size={15} /></span>}</div></Reveal>)}</div></div></section>
    <section id="features" className="mx-auto max-w-[1200px] scroll-mt-28 px-5 py-16 md:px-8 md:py-24" aria-label="Product features"><SectionHeading label="Features" title="Everything you need, in the right place." /><div className="grid gap-4 md:grid-cols-2">{featureCards.map(({ title, text, preview: Preview }) => <Reveal key={title}><article className="grid h-full min-h-[235px] grid-cols-[1fr_1.05fr] items-center gap-5 overflow-hidden rounded-2xl border border-border bg-muted/35 p-5 md:gap-7 md:p-6"><div><h3 className="text-base font-medium tracking-tight">{title}</h3><p className="mt-3 text-xs leading-5 text-muted-foreground">{text}</p></div><div className="pointer-events-none select-none" aria-hidden="true"><Preview /></div></article></Reveal>)}</div></section>
    <section className="mx-auto max-w-[1200px] px-5 pb-20 pt-4 md:px-8 md:pb-28" aria-label="Context continuation"><SectionHeading label="Your workspace adapts" title="Keep your context. Shape your workspace.">Add what you need. Remove what you don’t. Other components and your edits stay in place.</SectionHeading><div className="grid gap-6 md:grid-cols-3">{[{ title: 'Show tasks', text: 'Bring your work into view.' }, { title: 'Add meetings', text: 'Meetings join the existing workspace.' }, { title: 'Remove suggestions', text: 'Tasks and meetings stay in place.' }].map((step, index) => <Reveal key={step.title} className="relative"><div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-start gap-2.5"><span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/10 text-[10px] text-primary">{index + 1}</span><div><h3 className="text-sm font-medium">{step.title}</h3><p className="mt-1 text-[10px] leading-4 text-muted-foreground">{step.text}</p></div></div><ContextPreview step={index} /></div>{index < 2 && <ChevronRight aria-hidden="true" size={15} className="absolute -right-5 top-1/2 hidden text-primary md:block" />}</Reveal>)}</div></section>
    <section className="relative isolate overflow-hidden border-t border-border px-5 py-20 text-center md:py-28" aria-labelledby="closing-title"><div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10"><img src={landscape} alt="" loading="lazy" className="h-full w-full object-cover object-[center_70%] opacity-15" /><div className="absolute inset-0 bg-linear-to-b from-white via-white/80 to-white" /></div><p className="mb-4 text-[10px] uppercase tracking-[0.24em] text-primary">Get started</p><h2 id="closing-title" className="text-[clamp(2rem,4vw,3.6rem)] font-medium leading-tight tracking-[-0.045em]">What do you want to accomplish?</h2><p className="mt-4 text-sm text-muted-foreground">Tell Orlo what you need. Bring the right tools into view.</p><Link to="/" className={`${linkClass} mt-7 inline-flex items-center gap-4`}>Open workspace <ArrowRight size={16} /></Link><p className="mt-4 flex items-center justify-center gap-2 text-[10px] text-muted-foreground"><Command size={11} />Ctrl / Cmd + K to open Orlo</p></section>
    </main>
    <footer className="border-t border-border px-5 py-7 md:px-8"><div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6"><Link to="/landing" aria-label="Orlo home"><Wordmark /></Link><nav aria-label="Footer navigation" className="flex gap-6 text-xs text-muted-foreground"><a href="#features" onClick={event => navigateSection(event, 'features')}>Features</a><a href="#how-it-works" onClick={event => navigateSection(event, 'how-it-works')}>How it works</a><a href="#demo" onClick={event => navigateSection(event, 'demo')}>Demo</a></nav></div></footer>
  </div>
}
