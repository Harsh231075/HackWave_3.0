import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { motion, useReducedMotion } from 'motion/react'
import { Check, FileText, ListTodo, CalendarDays, ChartNoAxesColumn, GripVertical } from 'lucide-react'
import { OrloLogo } from '@/components/shell/OrloLogo'

const modules = [
  { kind: 'tasks', title: 'Tasks', icon: ListTodo, x: [76, 20, 20, 20, 76], y: [84, 72, 72, 72, 84], width: [340, 340, 432, 432, 340], height: [202, 360, 216, 216, 202], rotate: [-5, 0, 0, 0, -5] },
  { kind: 'calendar', title: 'Schedule', icon: CalendarDays, x: [418, 384, 472, 472, 418], y: [100, 72, 72, 72, 100], width: [242, 356, 268, 268, 242], height: [266, 174, 360, 360, 266], rotate: [5, 0, 0, 0, 5] },
  { kind: 'progress', title: 'Progress', icon: ChartNoAxesColumn, x: [72, 384, 20, 20, 72], y: [312, 270, 312, 312, 312], width: [250, 204, 256, 256, 250], height: [112, 162, 120, 120, 112], rotate: [-4, 0, 0, 0, -4] },
  { kind: 'notes', title: 'Notes', icon: FileText, x: [364, 612, 300, 300, 364], y: [344, 270, 312, 312, 344], width: [208, 128, 152, 152, 208], height: [94, 162, 120, 120, 94], rotate: [4, 0, 0, 0, 4] },
] as const

function ModulePreview({ kind }: { kind: typeof modules[number]['kind'] }) {
  if (kind === 'tasks') return <div className="space-y-3">{[0, 1, 2].map(row => <div key={row} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5"><span className={`flex size-4 shrink-0 items-center justify-center rounded border ${row === 0 ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border'}`}>{row === 0 && <Check size={10} />}</span><div className="flex-1 space-y-2"><div className={`h-1.5 rounded-full bg-foreground/10 ${row === 1 ? 'w-4/5' : 'w-3/5'}`} /><div className="h-1 w-1/3 rounded-full bg-muted-foreground/10" /></div><span className="h-4 w-10 rounded-full bg-primary/7" /></div>)}</div>
  if (kind === 'calendar') return <div className="space-y-3"><div className="flex items-center justify-between"><span className="h-1.5 w-16 rounded bg-foreground/10" /><div className="flex gap-1"><span className="size-4 rounded bg-muted" /><span className="size-4 rounded bg-muted" /></div></div><div className="grid grid-cols-7 gap-1.5">{Array.from({ length: 21 }, (_, cell) => <span key={cell} className={`flex h-6 items-center justify-center rounded-md ${[8, 9, 16].includes(cell) ? 'border border-primary/15 bg-primary/10' : 'bg-muted/55'}`}>{cell === 9 && <span className="size-1.5 rounded-full bg-primary/60" />}</span>)}</div><div className="flex gap-3 rounded-lg border border-primary/10 bg-primary/5 p-3"><span className="w-0.5 rounded bg-primary/45" /><div className="flex-1 space-y-2"><div className="h-1.5 w-2/3 rounded bg-primary/20" /><div className="h-1 w-1/2 rounded bg-primary/10" /></div></div></div>
  if (kind === 'progress') return <div className="flex h-12 items-end gap-2 border-b border-border/70 pb-1">{[35, 55, 42, 78, 62, 94, 76].map((height, index) => <div key={index} className="flex-1 rounded-t-sm bg-primary/20" style={{ height: `${height}%`, opacity: 0.35 + index * 0.09 }} />)}</div>
  return <div className="space-y-2.5"><div className="h-1.5 w-full rounded-full bg-foreground/12" /><div className="h-1.5 w-4/5 rounded-full bg-foreground/8" /><div className="h-1.5 w-3/5 rounded-full bg-primary/15" /><div className="h-1.5 w-4/5 rounded-full bg-foreground/8" /></div>
}

/** Decorative composition preview; it never manipulates the real canvas or reports tool progress. */
export function WorkspaceOrganizingLoader({ onStop }: { onStop: () => void }) {
  const reducedMotion = useReducedMotion()
  const [bounds, setBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const stopButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('.workspace-main-panel')
    const header = panel?.querySelector<HTMLElement>('.canvas-header')
    const measure = () => {
      const rect = panel?.getBoundingClientRect()
      const left = Math.max(0, rect?.left ?? 0)
      const top = Math.max(0, header && !header.hidden ? header.getBoundingClientRect().bottom : rect?.top ?? 0)
      const next = { top, left, width: Math.max(0, Math.min(window.innerWidth, rect?.right ?? window.innerWidth) - left), height: Math.max(0, window.innerHeight - top) }
      setBounds(previous => previous && Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    if (panel) observer.observe(panel)
    if (header) observer.observe(header)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [])
  const hasBounds = bounds !== null
  useEffect(() => {
    if (!hasBounds) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    stopButton.current?.focus({ preventScroll: true })
    return () => { if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true }) }
  }, [hasBounds])
  if (!bounds) return null
  return createPortal(<motion.div
    initial={reducedMotion ? false : { opacity: 0, backdropFilter: 'blur(0px)' }}
    animate={{ opacity: 1, backdropFilter: 'blur(4px)' }}
    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
    transition={{ duration: reducedMotion ? 0 : 0.35 }}
    style={bounds}
    className="fixed z-20 flex flex-col items-center [justify-content:safe_center] gap-8 overflow-y-auto bg-background/35 px-6 py-8"
    role="region" aria-label="Organizing your workspace"
  >
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent),transparent_65%)] opacity-15" />
    <div className="relative flex flex-col items-center gap-4 rounded-2xl bg-background/70 px-6 py-4 text-center backdrop-blur-sm">
      <div className="flex size-12 items-center justify-center rounded-2xl border border-primary/10 bg-background shadow-sm"><OrloLogo size={28} /></div>
      <div><p role="status" aria-live="polite" className="text-xl font-medium tracking-tight text-foreground">Organizing your workspace…</p><p className="mt-2 text-sm leading-5 text-muted-foreground">Your tools, brought together around your request.</p></div>
    </div>
    <div className="relative shrink-0" style={{ width: Math.min(760, Math.max(240, bounds.width - 48)), height: 460 * Math.min(1, Math.max(240, bounds.width - 48) / 760) }} aria-hidden="true">
      <div className="absolute left-0 top-0 h-[460px] w-[760px] origin-top-left" style={{ transform: `scale(${Math.min(1, Math.max(240, bounds.width - 48) / 760)})` }}>
        <div className="absolute inset-0 rounded-3xl border border-border/70 bg-background/40 shadow-[0_30px_90px_-55px_rgba(112,89,201,0.35)]" />
        <div className="absolute inset-x-0 top-0 flex h-12 items-center justify-between border-b border-border/60 px-5"><div className="flex items-center gap-2"><span className="size-1.5 rounded-full bg-primary/45" /><span className="text-[11px] font-medium tracking-wide text-muted-foreground">WORKSPACE PREVIEW</span></div><div className="flex gap-1.5">{[0, 1, 2].map(dot => <span key={dot} className="size-1.5 rounded-full bg-border" />)}</div></div>
        <div className="absolute inset-x-4 bottom-4 top-16 rounded-2xl bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] opacity-40" />
        <motion.div className="absolute left-[456px] top-[64px] h-[376px] border-l border-dashed border-primary/20" animate={{ opacity: reducedMotion ? 0.3 : [0.1, 0.7, 0.3, 0.3, 0.1] }} transition={{ duration: reducedMotion ? 0 : 9.5, repeat: reducedMotion ? 0 : Infinity }} />
        {modules.map(({ kind, title, icon: Icon, x, y, width, height, rotate }, index) => <motion.div
          key={kind}
          data-organizing-module={kind}
          initial={reducedMotion ? false : { x: x[0], y: y[0], width: width[0], height: height[0], rotate: rotate[0] }}
          animate={reducedMotion
            ? { x: x[2], y: y[2], width: width[2], height: height[2], rotate: 0 }
            : { x: [...x], y: [...y], width: [...width], height: [...height], rotate: [...rotate] }}
          transition={reducedMotion ? { duration: 0 } : { duration: 9.5, repeat: Infinity, ease: [0.22, 1, 0.36, 1], times: [0, 0.3, 0.58, 0.82, 1] }}
          className="absolute left-0 top-0 overflow-hidden rounded-2xl border border-border bg-background p-4 shadow-[0_12px_32px_-18px_rgba(37,41,54,0.28)]"
          style={{ zIndex: 4 - index }}
        >
          <div className="mb-3 flex items-center gap-2.5"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/5 text-primary/70"><Icon size={14} strokeWidth={1.7} /></span><span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground/75">{title}</span><GripVertical size={12} className="shrink-0 text-muted-foreground/30" /></div>
          <ModulePreview kind={kind} />
        </motion.div>)}
      </div>
    </div>
    <div className="relative flex flex-col items-center gap-2 rounded-xl bg-background/75 px-5 py-3 backdrop-blur-sm"><Button ref={stopButton} variant="outline" onClick={onStop}>Stop organizing</Button><p className="text-xs text-muted-foreground">Esc to stop · Your saved workspace is kept</p></div>
  </motion.div>, document.body)
}
