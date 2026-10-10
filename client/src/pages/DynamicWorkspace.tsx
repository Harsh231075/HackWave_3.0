import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useOutletContext } from 'react-router-dom'
import { createParser, Renderer } from '@openuidev/react-lang'
import { ArrowUp, Command, LoaderCircle, Sparkles } from 'lucide-react'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { PRESETS } from '@/lib/workspace/config'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const defaultWorkspace = `root = Card([Workspace([${PRESETS.home.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])])`
const parser = createParser(productivityLibrary.toJSONSchema(), productivityLibrary.root)

export function DynamicWorkspace() {
  const { headerActions } = useOutletContext<{ headerActions: HTMLDivElement | null }>()
  const { state, draftBuffers } = useWorkspace()
  const [goal, setGoal] = useState('')
  const [response, setResponse] = useState(defaultWorkspace)
  const [commandOpen, setCommandOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const canvas = useRef<HTMLElement | null>(null)
  const [componentState, setComponentState] = useState<Record<string, unknown>>({})
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen(value => !value)
      }
    }
    window.addEventListener('keydown', handle)
    return () => { window.removeEventListener('keydown', handle); request.current?.abort() }
  }, [])

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!goal.trim() || pending) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPending(true); setError('')
    try {
      const result = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ goal: goal.trim(), previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } }),
      })
      const body = await result.json()
      if (!result.ok) throw new Error(body.error?.message ?? 'Unable to build your workspace. Try again.')
      if (typeof body.response !== 'string') throw new Error('The model returned an empty workspace. Try again.')
      const parsed = parser.parse(body.response)
      if (!parsed.root || parsed.meta.errors.length || parsed.meta.incomplete || parsed.meta.unresolved.length || parsed.queryStatements.length || parsed.mutationStatements.length) throw new Error('The generated layout could not be validated. Try describing your goal more precisely.')
      setResponse(body.response); setGoal(''); setCommandOpen(false)
      requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to build your workspace.')
    } finally { if (request.current === controller) { request.current = null; setPending(false) } }
  }
  const form = () => <form onSubmit={generate} className="goal-form">
    <div className="goal-input-row"><Sparkles size={20} aria-hidden="true" /><label htmlFor={'command-goal'} className="sr-only">Describe the workspace you need</label><input id={'command-goal'} autoFocus value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div>
    {pending && <div className="goal-progress" role="status">Building your workspace… <button type="button" onClick={() => { request.current?.abort(); setPending(false) }}>Cancel</button></div>}
    {error && <p className="goal-error" role="alert">{error}</p>}
  </form>

  return <div className="dynamic-canvas-page">
    {headerActions && createPortal(<button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button>, headerActions)}
      <main className="generated-canvas" ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace"><Renderer library={productivityLibrary} response={response} isStreaming={false} initialState={componentState} onStateUpdate={setComponentState} onAction={() => { setCommandOpen(true); setError('Describe the next change you want to make.') }} /></main>
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a new goal or refine the current layout. Escape closes this command window.</DialogDescription></DialogHeader>{form()}<div className="command-hint"><span>Enter to build</span><span>Esc to close</span></div></DialogContent></Dialog>
  </div>
}
