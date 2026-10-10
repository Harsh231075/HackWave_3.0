import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Renderer } from '@openuidev/react-lang'
import { ArrowUp, Command, LoaderCircle, MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { layoutService } from '@/services'
import { useWorkspaceGeneration } from '@/hooks/useWorkspaceGeneration'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PRESETS } from '@/lib/workspace/config'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const defaultWorkspace = `root = Card([Workspace([${PRESETS.home.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])])`
function restoreLayout() {
  const saved = layoutService.load()
  return {
    response: saved.status === 'found' ? saved.value : defaultWorkspace,
    notice: saved.status === 'invalid' ? 'Saved layout is unavailable. Showing the default dashboard.' : saved.status === 'unavailable' ? 'Device storage is unavailable. Showing the default dashboard.' : '',
  }
}

export function DynamicWorkspace() {
  const { state, draftBuffers } = useWorkspace()
  const [goal, setGoal] = useState('')
  const [restored] = useState(restoreLayout)
  const [response, setResponse] = useState(restored.response)
  const [persistenceNotice, setPersistenceNotice] = useState(restored.notice)
  const [revision, setRevision] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const { pending, error, setError, generate: generateLayout, cancel: cancelRequest } = useWorkspaceGeneration()
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
    return () => { window.removeEventListener('keydown', handle) }
  }, [])

  function resetLayout() {
    cancelRequest()
    const cleared = layoutService.clear().status === 'saved'
    setResponse(defaultWorkspace); setComponentState({}); setRevision(value => value + 1)
    setGoal(''); setError(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }

  async function generate(event: FormEvent) {
    event.preventDefault()
    if (!goal.trim() || pending) return
    const sanitized = await generateLayout({ goal: goal.trim(), previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } })
    if (sanitized === null) return
    const saved = layoutService.save(sanitized)
    setPersistenceNotice(saved.status === 'saved' ? '' : 'Layout updated, but device storage is unavailable. It may not survive reload.')
    setResponse(sanitized); setGoal(''); setCommandOpen(false)
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }

  const form = () => <form onSubmit={generate} className="goal-form">
    <div className="goal-input-row"><OrloLogo size={20} /><label htmlFor={'command-goal'} className="sr-only">Describe the workspace you need</label><input id={'command-goal'} autoFocus value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div>
    {pending && <div className="goal-progress" role="status">Building your workspace… <button type="button" onClick={cancelRequest}>Cancel</button></div>}
    {error && <p className="goal-error" role="alert">{error}</p>}
  </form>

  return <div className="dynamic-canvas-page">
    <PageHeaderActions><button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={resetLayout}><RotateCcw size={14} /> Reset layout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>
      <main className="generated-canvas" ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace">{persistenceNotice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>}<Renderer key={revision} library={productivityLibrary} response={response} isStreaming={false} initialState={componentState} onStateUpdate={setComponentState} onAction={() => { setCommandOpen(true); setError('Describe the next change you want to make.') }} /></main>
      <Dialog open={commandOpen} onOpenChange={setCommandOpen}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a new goal or refine the current layout. Escape closes this command window.</DialogDescription></DialogHeader>{form()}<div className="command-hint"><span>Enter to build</span><span>Esc to close</span></div></DialogContent></Dialog>
  </div>
}
