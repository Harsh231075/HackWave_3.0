import { Link } from 'react-router'
import { ArrowRight, BookOpen, Check, Clock3, Layers, Sparkles, Target } from 'lucide-react'
import { Brand } from '@/components/shell/AppShell'

export function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500/30 selection:text-indigo-200 relative overflow-hidden font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-tr from-indigo-600/20 via-purple-600/10 to-transparent blur-[140px] pointer-events-none -z-0" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[350px] bg-indigo-900/10 blur-[120px] pointer-events-none -z-0" />

      {/* Top Navbar */}
      <header className="relative z-10 w-full border-b border-slate-800/70 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" aria-label="GoGPT home" className="flex items-center gap-2">
            <Brand />
          </Link>
          
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium text-slate-400 bg-slate-900/80 border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
            HackWave 3.0 · Human-Centered AI
          </div>

          <Link
            to="/app"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-sm shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5"
          >
            Open workspace <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Copy Column */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase text-indigo-300 bg-indigo-950/60 border border-indigo-800/60 shadow-inner w-fit">
              <Sparkles size={14} className="text-indigo-400" />
              <span>Your Goals. Your Space.</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
              Less navigating.<br />
              More <em className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent not-italic font-black">making progress.</em>
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-xl">
              An intelligent, adaptive workspace designed for studying, teaching, and getting work done.
              Keep your tasks, time blocks, and preparation together in one unified canvas.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-2">
              <Link
                to="/app"
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all"
              >
                Explore the static workspace <ArrowRight size={18} />
              </Link>
              <span className="text-xs text-slate-500 font-medium">
                Frontend preview · No signup · Instant demo data
              </span>
            </div>

            <div className="flex items-center gap-3 pt-4">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Designed for</span>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-md">
                  <BookOpen size={13} className="text-indigo-400" /> Students
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-md">
                  <Layers size={13} className="text-purple-400" /> Teachers
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-md">
                  <Target size={13} className="text-pink-400" /> Professionals
                </span>
              </div>
            </div>
          </div>

          {/* Right Interactive Preview Card */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-6 shadow-2xl shadow-black/80 backdrop-blur-xl flex flex-col gap-5 relative group hover:border-slate-700/80 transition-all">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 text-xs text-slate-400">
                <Brand />
                <span className="px-2.5 py-0.5 rounded-full bg-slate-800/70 text-slate-300 font-medium">
                  Monday, October 12
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">A little clarity for your day.</h2>
                <p className="text-xs text-slate-400 mt-0.5">You’ve got room to make progress.</p>
              </div>

              {/* Metric stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950/60 border border-slate-800/70 p-3.5 rounded-xl flex flex-col">
                  <span className="text-xs text-slate-400 font-medium">Open tasks</span>
                  <strong className="text-2xl font-bold text-white mt-1">5</strong>
                </div>
                <div className="bg-slate-950/60 border border-slate-800/70 p-3.5 rounded-xl flex flex-col">
                  <span className="text-xs text-slate-400 font-medium">Focus time</span>
                  <strong className="text-2xl font-bold text-emerald-400 mt-1">1.5h</strong>
                </div>
              </div>

              {/* Sample Task 1 */}
              <div className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/70 p-3 rounded-xl text-xs">
                <span className="w-4 h-4 rounded border border-slate-600 flex items-center justify-center flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200 truncate">Finish the research proposal</p>
                  <span className="text-[11px] text-slate-400">Research methods · Today</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/60 border border-rose-800/50 text-rose-300">
                  High
                </span>
              </div>

              {/* Sample Task 2 (Completed) */}
              <div className="flex items-center gap-3 bg-slate-950/30 border border-slate-800/50 p-3 rounded-xl text-xs opacity-70">
                <span className="w-4 h-4 rounded bg-indigo-600 border border-indigo-500 flex items-center justify-center text-white flex-shrink-0">
                  <Check size={11} strokeWidth={3} />
                </span>
                <div className="flex-1 min-w-0 line-through text-slate-400">
                  <p className="font-medium truncate">Organize lecture notes</p>
                  <span className="text-[11px] text-slate-500">Statistics · Completed</span>
                </div>
              </div>

              {/* Focus Time Block */}
              <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-800/40 p-3.5 rounded-xl text-xs text-emerald-300">
                <div className="p-2 rounded-lg bg-emerald-900/40 text-emerald-400">
                  <Clock3 size={17} />
                </div>
                <div className="flex-1">
                  <strong className="block font-semibold text-slate-200">A little time to focus.</strong>
                  <span className="text-[11px] text-emerald-400/90">09:30–11:00 · Research & writing</span>
                </div>
              </div>

              <Link
                to="/app?view=workspace"
                className="inline-flex items-center justify-center gap-2 pt-2 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                See how the canvas adapts to goals <ArrowRight size={13} />
              </Link>
            </div>
          </div>
        </div>

        {/* 3 Principles Section */}
        <section className="max-w-7xl mx-auto px-6 py-16 border-t border-slate-800/70">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-indigo-950/70 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
                <Layers size={20} />
              </div>
              <h3 className="text-base font-bold text-white">One canvas, many goals.</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Preview planning, preparation, and recovery with the same reusable components without navigating fragmented tools.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-purple-950/70 border border-purple-800/60 flex items-center justify-center text-purple-400">
                <BookOpen size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Keep the context close.</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Sources and editable outlines give you the materials to actually do the work right in place instead of passive text.
              </p>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-6 flex flex-col gap-3 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-pink-950/70 border border-pink-800/60 flex items-center justify-center text-pink-400">
                <Target size={20} />
              </div>
              <h3 className="text-base font-bold text-white">Your work stays with you.</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Switch views and preset layouts smoothly without losing local drafts, completed tasks, or pinned widgets.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/70 bg-slate-950/80">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
          <span>GoGPT · Built for HackWave 3.0 · Problem Statement 4</span>
          <span>Static frontend prototype · Intent-to-Interface</span>
        </div>
      </footer>
    </div>
  )
}
