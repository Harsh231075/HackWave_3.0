import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { createParser, Renderer } from '@openuidev/react-lang'
import { ArrowUp, Command, LoaderCircle, MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { clearLayout, readLayout } from '@/lib/workspace/layoutPersistence'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PRESETS } from '@/lib/workspace/config'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const defaultWorkspace = `root = Card([Workspace([${PRESETS.home.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])])`
const parser = createParser(productivityLibrary.toJSONSchema(), productivityLibrary.root)

function repairOpenUI(code: string): string {
  return code
    .replace(/^```[^\n]*\n?/gm, '')
    .replace(/```\s*$/gm, '')
    .replace(/FormControl\(([^,]+),\s*([^,\)]+(?:\([^\)]*\))?),\s*\{[^}]*\}\)/g, 'FormControl($1, $2)')
    .replace(/Button\(([^,]+,[^,]+,[^,\)]+),\s*"(?:small|medium|large|extra-small)"\)/g, 'Button($1)')
    .replace(/WorkspaceWidget\("(?:quick-capture|quick_capture|notes|draft)"/g, 'WorkspaceWidget("outline"')
    .replace(/WorkspaceWidget\("(?:schedule)"/g, 'WorkspaceWidget("calendar"')
    .replace(/WorkspaceWidget\("(?:overview|dashboard)"/g, 'WorkspaceWidget("metrics"')
    .trim()
}

function validLayout(response: string): boolean {
  try {
    const parsed = parser.parse(response)
    return !!parsed.root && !parsed.meta.errors.length && !parsed.meta.incomplete && !parsed.meta.unresolved.length && !parsed.queryStatements.length && !parsed.mutationStatements.length
  } catch { return false }
}
const browserStorage = () => window.localStorage
function restoreLayout() {
  const saved = readLayout(browserStorage, validLayout)
  return {
    response: saved.status === 'saved' ? saved.response : defaultWorkspace,
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

  function cancelRequest() {
    request.current?.abort()
    request.current = null
    setPending(false)
  }
  function resetLayout() {
    cancelRequest()
    const cleared = clearLayout(browserStorage)
    setResponse(defaultWorkspace); setComponentState({}); setRevision(value => value + 1)
    setGoal(''); setError(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }

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
      if (controller.signal.aborted || request.current !== controller) return
      if (!result.ok) throw new Error(body.error?.message ?? 'Unable to build your workspace. Try again.')
      if (typeof body.response !== 'string') throw new Error('The model returned an empty workspace. Try again.')
      const sanitized = repairOpenUI(body.response)
      const parsed = parser.parse(sanitized)
      if (!parsed.root || parsed.meta.incomplete || parsed.queryStatements.length || parsed.mutationStatements.length) {
        console.warn('[OpenUI] Layout parse issues:', parsed.meta, sanitized)
        const reason = !parsed.root ? 'missing root' : parsed.meta.incomplete ? 'incomplete syntax' : 'unsupported statements'
        throw new Error(`The generated layout could not be validated (${reason}). Try describing your goal more precisely.`)
      }
      setResponse(sanitized); setGoal(''); setCommandOpen(false)
      requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) setError(failure instanceof Error ? failure.message : 'Unable to build your workspace.')
    } finally { if (request.current === controller) { request.current = null; setPending(false) } }
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
