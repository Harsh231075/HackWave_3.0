import { useMeetingScope } from '@/hooks/useMeetingScope'
import { MeetingEvidence } from '@/components/resources/MeetingPreparationWidgets'
import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Info, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { configSchema, widgetTypes, type WidgetType } from './config'
import { registry, widgetTitle } from './registry'
import { WidgetHeaderContext, WidgetPageActionsContext } from './WidgetHeaderContext'

class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace widget failed', error, info.componentStack) }
  render() { return this.state.failed ? <p className="[color:#ef4444] text-[length:0.8rem] font-medium p-5" role="alert">This widget couldn’t render. Switch views or reload the demo to try again.</p> : this.props.children }
}
export function WidgetFrame({ id, children, pageActions = false }: { id: WidgetType; children: ReactNode; pageActions?: boolean }) {
  const { state, togglePin } = useWorkspace()
  const [why, setWhy] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  const meetingScope = useMeetingScope()
  const definition = registry[id]
  const Icon = definition.icon
  const pinned = state.pins.includes(id)
  return <WidgetPageActionsContext.Provider value={pageActions}><WidgetHeaderContext.Provider value={headerSlot}><section className={`bg-(--card) [border:1px_solid_var(--border)] rounded-[var(--radius)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] flex flex-col p-5 h-full widget-${id}`} aria-label={widgetTitle(id)}><header className="flex flex-wrap gap-3 justify-between items-center mb-4 pb-3 [border-bottom:1px_solid_var(--border)] [&_h2]:text-[length:1.05rem] [&_h2]:font-semibold [&_h2]:inline-flex [&_h2]:items-center [&_h2]:[gap:0.55rem] [&_h2_svg]:text-(--primary)"><h2><Icon size={16} />{widgetTitle(id)}</h2><div className="ml-auto flex flex-wrap items-center gap-2"><div ref={setHeaderSlot} className="flex flex-wrap items-center gap-2" /><div className="flex items-center gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Why show ${widgetTitle(id)}?`} aria-expanded={why} onClick={() => setWhy(!why)}><Info size={14} /></Button><Button variant="ghost" size="icon-sm" className={pinned ? 'text-(--primary)! bg-(--accent)!' : ''} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${widgetTitle(id)}`} aria-pressed={pinned} onClick={() => togglePin(id)}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</Button></div></div></header>{why && <div className="bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] [padding:0.65rem_0.85rem] mb-4 text-[length:0.82rem] [&_strong]:block [&_strong]:text-[length:0.75rem] [&_strong]:text-(--primary) [&_strong]:[margin-bottom:0.2rem] [&_p]:text-(--muted-foreground)"><strong>Why this component</strong>{meetingScope ? <MeetingEvidence widgetId={id} /> : <p>{definition.reason}</p>}</div>}<WidgetBoundary>{children}</WidgetBoundary></section></WidgetHeaderContext.Provider></WidgetPageActionsContext.Provider>
}
export function WorkspaceRenderer({ config, pageActionWidget }: { config: unknown; pageActionWidget?: WidgetType }) {
  const { state } = useWorkspace()
  const reducedMotion = useReducedMotion()
  const parsed = configSchema.safeParse(config)
  if (!parsed.success) return <div className="invalid-workspace" role="alert"><h2>This layout isn’t available.</h2><p>The configuration contains invalid or unsupported widgets. Choose another preview.</p></div>
  const widgets = [...parsed.data.widgets]
  for (const pinned of state.pins) {
    if (widgetTypes.includes(pinned as WidgetType) && !widgets.some(widget => widget.id === pinned)) widgets.push({ id: pinned as WidgetType, span: pinned === 'metrics' ? 'full' : 'narrow' })
  }
  return <div className="grid grid-cols-12 gap-6">{widgets.map(widget => {
    const Widget = registry[widget.id].component
    return <motion.div key={widget.id} className={`min-w-0 [&.span-full]:col-span-12 [&.span-wide]:col-span-7 [&.span-narrow]:col-span-5 [@media(width<=1024px)]:[&.span-wide]:col-span-12 [@media(width<=1024px)]:[&.span-narrow]:col-span-12 span-${widget.span}`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>{widget.id === 'metrics' ? <Widget /> : <WidgetFrame id={widget.id} pageActions={widget.id === pageActionWidget}><Widget /></WidgetFrame>}</motion.div>
  })}</div>
}
