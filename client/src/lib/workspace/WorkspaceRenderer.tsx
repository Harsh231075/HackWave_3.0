import { Component, useState, type ErrorInfo, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Info, Pin, PinOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { configSchema, widgetTypes, type WidgetType } from './config'
import { registry, widgetTitle } from './registry'

class WidgetBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace widget failed', error, info.componentStack) }
  render() { return this.state.failed ? <p className="field-error p-5" role="alert">This widget couldn’t render. Switch views or reload the demo to try again.</p> : this.props.children }
}
export function WidgetFrame({ id, children }: { id: WidgetType; children: ReactNode }) {
  const { state, dispatch } = useWorkspace()
  const [why, setWhy] = useState(false)
  const definition = registry[id]
  const Icon = definition.icon
  const pinned = state.pins[state.role].includes(id)
  return <section className={`widget widget-${id}`} aria-label={widgetTitle(id, state.role)}><header className="widget-header"><h2><Icon size={16} />{widgetTitle(id, state.role)}</h2><div><Button variant="ghost" size="icon-sm" aria-label={`Why show ${widgetTitle(id, state.role)}?`} aria-expanded={why} onClick={() => setWhy(!why)}><Info size={14} /></Button><Button variant="ghost" size="icon-sm" className={pinned ? 'is-pinned' : ''} aria-label={`${pinned ? 'Unpin' : 'Pin'} ${widgetTitle(id, state.role)}`} aria-pressed={pinned} onClick={() => dispatch({ type: 'pin', role: state.role, id })}>{pinned ? <PinOff size={14} /> : <Pin size={14} />}</Button></div></header>{why && <div className="widget-explanation"><strong>Why shown · static preset</strong><p>{definition.reason}</p></div>}<WidgetBoundary>{children}</WidgetBoundary></section>
}
export function WorkspaceRenderer({ config }: { config: unknown }) {
  const { state } = useWorkspace()
  const reducedMotion = useReducedMotion()
  const parsed = configSchema.safeParse(config)
  if (!parsed.success) return <div className="invalid-workspace" role="alert"><h2>This layout isn’t available.</h2><p>The configuration contains invalid or unsupported widgets. Choose another preview.</p></div>
  const widgets = [...parsed.data.widgets]
  for (const pinned of state.pins[state.role]) {
    if (widgetTypes.includes(pinned as WidgetType) && !widgets.some(widget => widget.id === pinned)) widgets.push({ id: pinned as WidgetType, span: pinned === 'metrics' || pinned === 'board' ? 'full' : 'narrow' })
  }
  return <div className="workspace-grid">{widgets.map(widget => {
    const Widget = registry[widget.id].component
    return <motion.div key={widget.id} className={`workspace-cell span-${widget.span}`} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.16 }}>{widget.id === 'metrics' ? <Widget /> : <WidgetFrame id={widget.id}><Widget /></WidgetFrame>}</motion.div>
  })}</div>
}
