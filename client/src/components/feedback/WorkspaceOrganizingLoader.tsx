import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { organizingCanvas, organizingDuration, organizingFrames, organizingTimes, organizingVisibility } from './organizingLayouts'
import './WorkspaceOrganizingLoader.css'

const modules = [
  { kind: 'tasks', slot: 0 },
  { kind: 'calendar', slot: 1 },
  { kind: 'progress', slot: 2 },
  { kind: 'notes', slot: 3 },
  { kind: 'mail', slot: 3 },
  { kind: 'resources', slot: 2 },
  { kind: 'agenda', slot: 0 },
  { kind: 'meetings', slot: 1 },
  { kind: 'timer', slot: 4 },
] as const

function ModulePreview() {
  return <div className="space-y-4">
    <div className="mb-5 h-2 w-2/5 rounded-full bg-foreground/12"/>
    {[0, 1, 2, 3].map(row => <div key={row} className={`${row === 2 ? 'organizing-extra-row' : row === 3 ? 'organizing-tall-row' : 'flex'} items-center gap-3`}>
      <span className="size-3 shrink-0 rounded bg-muted"/>
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`h-1.5 rounded-full bg-foreground/8 ${row % 2 ? 'w-3/5' : 'w-4/5'}`}/>
        <div className="organizing-secondary h-1 w-1/3 rounded-full bg-muted"/>
      </div>
    </div>)}
  </div>
}

/** Decorative composition preview; it never manipulates the real canvas or reports tool progress. */
export function WorkspaceOrganizingLoader({ onStop }: { onStop: () => void }) {
  const reducedMotion = useReducedMotion()
  const animation = useAnimationControls()
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
  // Start explicitly: the canvas disables presence animations on its initial mount.
  useEffect(() => {
    if (hasBounds) void animation.start(reducedMotion ? 'still' : 'organizing')
    return () => animation.stop()
  }, [hasBounds, reducedMotion, animation])
  if (!bounds) return null
  const scale = Math.min(900 / organizingCanvas.width, Math.max(0, bounds.width - 32) / organizingCanvas.width, Math.max(0, bounds.height - 160) / organizingCanvas.height)
  return createPortal(<motion.div
    initial={reducedMotion ? false : { opacity: 0, backdropFilter: 'blur(0px)' }}
    animate={{ opacity: 1, backdropFilter: 'blur(1px)' }}
    exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
    transition={{ duration: reducedMotion ? 0 : 0.35 }}
    style={bounds}
    className="fixed z-20 flex flex-col items-center [justify-content:safe_center] overflow-y-auto bg-background/80 px-4 py-20"
    role="region" aria-label="Organizing your workspace"
  >
    <style>{modules.map(({ kind }) => {
      const frames = organizingVisibility(kind)
      return `@keyframes organizing-visibility-${kind} {${frames.times.map((time, index) => `${time * 100}% { opacity: ${frames.opacity[index]}; }`).join('')}}`
    }).join('')}</style>
    <p role="status" aria-live="polite" className="sr-only">Organizing your workspace</p>
    <Button ref={stopButton} size="sm" variant="outline" className="absolute bottom-24 lg:bottom-32 left-1/2 z-10 -translate-x-1/2 hover:bg-red-50" onClick={onStop}><Square aria-hidden="true" className="size-3 fill-current text-red-500"/>Stop</Button>
    <div className="relative shrink-0" style={{ width: organizingCanvas.width * scale, height: organizingCanvas.height * scale }} aria-hidden="true">
      <div className="absolute left-0 top-0 h-[460px] w-[760px] origin-top-left" style={{ transform: `scale(${scale})` }}>
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[16px_16px] opacity-35"/>
        {modules.map(({ kind, slot }) => {
          const frames = organizingFrames(slot, kind), visibility = organizingVisibility(kind), first = frames[0]
          return <motion.div key={kind} data-organizing-module={kind}
            initial={first}
            animate={animation}
            variants={{ still: first, organizing: { x: frames.map(frame => frame.x), y: frames.map(frame => frame.y), width: frames.map(frame => frame.width), height: frames.map(frame => frame.height) } }}
            transition={reducedMotion ? { duration: 0 } : { duration: organizingDuration, repeat: Infinity, ease: [0.22, 1, 0.36, 1], times: organizingTimes }}
            style={{ opacity: visibility.opacity[0], animation: reducedMotion ? 'none' : `organizing-visibility-${kind} ${organizingDuration}s linear infinite` }}
            className="organizing-card absolute left-0 top-0 overflow-hidden border border-border bg-card p-4">
            <ModulePreview/><div className="organizing-card-glow" style={{ animationDuration: `${organizingDuration}s`, animationDelay: `${-slot * organizingDuration / 5}s` }}/>
          </motion.div>
        })}
      </div>
    </div>
  </motion.div>, document.body)
}
