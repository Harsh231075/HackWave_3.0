import { Link } from 'react-router'
import { ArrowRight, BookOpen, Check, Clock3, Layers, Sparkles, Target } from 'lucide-react'
import { Brand } from '@/components/shell/AppShell'

const principles = [
  { icon: Layers, number: '01', title: 'Everything in one place.', description: 'Bring tasks, your calendar, and daily priorities together in a workspace that feels easy to use.' },
  { icon: BookOpen, number: '02', title: 'Stay close to the work.', description: 'Keep your sources, preparation, and editable outlines right beside the goal you’re working toward.' },
  { icon: Target, number: '03', title: 'Make room for progress.', description: 'Find your next step, protect time to focus, and build a day with a little more intention.' },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-accent selection:text-primary">
      <header className="border-b border-border bg-card/90">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8" aria-label="Main navigation">
          <Link to="/" aria-label="GoGPT home"><Brand /></Link>
          <span className="hidden items-center gap-2 text-xs font-medium text-muted-foreground md:inline-flex">
            <span className="size-1.5 rounded-full bg-primary" /> A little more clarity, every day
          </span>
          <Link to="/app" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
            Open workspace <ArrowRight size={15} />
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-primary">
              <Sparkles size={13} /> A calmer way to get things done
            </div>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.12] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
              A clear space.<br />
              <span className="text-primary">A focused day.</span>
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">
              Bring your tasks, time, and preparation together. Spend less time organizing and more time making meaningful progress.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/app" className="inline-flex items-center gap-3 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
                Explore your workspace <ArrowRight size={16} />
              </Link>
              <span className="text-xs text-muted-foreground">No signup · Instant demo</span>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-border pt-6 text-xs text-muted-foreground">
              <span className="font-medium">Made for your day</span>
              <span className="inline-flex items-center gap-1.5"><BookOpen size={13} /> Students</span>
              <span className="inline-flex items-center gap-1.5"><Layers size={13} /> Teachers</span>
              <span className="inline-flex items-center gap-1.5"><Target size={13} /> Professionals</span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-3 -z-0 rounded-[2rem] bg-accent/60 sm:-inset-5" />
            <div className="relative flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-lg)] sm:p-7">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <span className="text-sm font-semibold">Your daily overview</span>
                <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">Mon, Oct 12</span>
              </div>
              <div>
                <p className="text-xs font-medium text-primary">GOOD MORNING, MAYA</p>
                <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Let’s make a little progress.</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your priorities, with room to breathe.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-background p-4">
                  <span className="text-xs text-muted-foreground">Open tasks</span>
                  <strong className="mt-1 block text-3xl font-semibold tracking-tight">5</strong>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <span className="text-xs text-muted-foreground">Focus time</span>
                  <strong className="mt-1 block text-3xl font-semibold tracking-tight text-primary">1.5<span className="text-lg">h</span></strong>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl border border-border p-3.5">
                  <span className="size-4 shrink-0 rounded border border-input" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Finish the research proposal</p>
                    <span className="text-xs text-muted-foreground">Research methods · Today</span>
                  </div>
                  <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800">Priority</span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3.5">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded bg-primary text-white"><Check size={11} strokeWidth={3} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-muted-foreground line-through">Organize lecture notes</p>
                    <span className="text-xs text-muted-foreground">Statistics · Completed</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-primary/15 bg-accent p-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><Clock3 size={18} /></span>
                <div>
                  <strong className="block text-sm font-medium">A little time to focus.</strong>
                  <span className="text-xs text-primary">09:30–11:00 · Research & writing</span>
                </div>
              </div>
              <Link to="/app?view=workspace" className="inline-flex items-center justify-between border-t border-border pt-4 text-xs font-medium text-primary hover:underline">
                Find the layout that works for you <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
            <div className="mb-9 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">Less friction. More focus.</h2>
              <p className="text-sm text-muted-foreground">Thoughtfully designed around the way you work.</p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {principles.map(({ icon: Icon, number, title, description }) => (
                <article key={number} className="rounded-2xl border border-border bg-background/60 p-6">
                  <div className="mb-6 flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-primary"><Icon size={19} /></span>
                    <span className="font-mono text-xs text-muted-foreground">{number}</span>
                  </div>
                  <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col justify-between gap-3 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:px-8">
        <span>GoGPT · Built for HackWave 3.0</span>
        <span>Frontend preview · Your work, a little clearer.</span>
      </footer>
    </div>
  )
}
