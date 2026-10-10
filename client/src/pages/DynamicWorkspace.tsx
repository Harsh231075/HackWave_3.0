import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Renderer } from '@openuidev/react-lang'
import { ArrowUp, Command, LoaderCircle, MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { layoutService, meetingPreparationService } from '@/services'
import { useAdaptiveWorkspace, type Clarification } from '@/hooks/useAdaptiveWorkspace'
import { MeetingScopeProvider } from '@/state/MeetingScope'
import type { MeetingLayout } from '@/services/layoutService'
import { validateMeetingComposition } from '@/domain/adaptiveData'
import type { IntentRequest } from '@/domain/intent'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PRESETS } from '@/lib/workspace/config'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { DEMO_DATE } from '@/data/demo'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const defaultWorkspace = `root = Card([Workspace([${PRESETS.home.widgets.map(widget => `WorkspaceWidget(${JSON.stringify(widget.id)}, ${JSON.stringify(widget.span)})`).join(', ')}])])`
function restoreLayout() {
  const saved = layoutService.loadSession()
  let meeting: MeetingLayout | null = null
  if (saved.status === 'found' && saved.value.version === 2 && saved.value.kind === 'meeting') {
    const session = saved.value
    const preparation = meetingPreparationService.load(session.meetingId)
    if (preparation.status === 'found' && validateMeetingComposition(session.composition, { version: 1, requestId: session.composition.requestId, intent: session.intent, preparation: preparation.value, agenda: preparation.value.meeting.agenda }).success) meeting = session
    else return { response: defaultWorkspace, meeting: null, notice: 'Saved meeting records are unavailable. Showing the default dashboard.' }
  }
  return { response: saved.status === 'found' ? saved.value.response : defaultWorkspace, meeting,
    notice: saved.status === 'invalid' ? 'Saved layout is unavailable. Showing the default dashboard.' : saved.status === 'unavailable' ? 'Device storage is unavailable. Showing the default dashboard.' : '',
  }
}
function ClarificationForm({ question, pending, onAnswer, onCancel }: { question: Clarification; pending: boolean; onAnswer: (answer: NonNullable<IntentRequest['clarificationAnswer']>) => void; onCancel: () => void }) {
  const [selection, setSelection] = useState<string | null>(null)
  const [from, setFrom] = useState(question.partialIntent.dateRange?.from ?? '')
  const [to, setTo] = useState(question.partialIntent.dateRange?.to ?? '')
  return <form className="space-y-4 p-2" onSubmit={event => {
    event.preventDefault()
    const base = { requestId: question.requestId, originalGoal: question.originalGoal }
    if (question.field === 'dateRange') onAnswer({ ...base, field: 'dateRange', dateRange: { from, to } })
    else if (selection) onAnswer({ ...base, field: question.field, selectedId: selection })
  }}><p className="text-sm font-medium" role="status">{question.question}</p>{question.field === 'dateRange' ? <div className="flex gap-3"><label className="text-sm">From<input aria-label="Clarification from date" className="mt-1 block rounded border p-2" type="date" value={from} onChange={event => setFrom(event.target.value)} required disabled={pending} /></label><label className="text-sm">Through<input aria-label="Clarification through date" className="mt-1 block rounded border p-2" type="date" min={from} value={to} onChange={event => setTo(event.target.value)} required disabled={pending} /></label></div> : <Select items={question.choices.map(choice => ({ value: choice.id, label: choice.label }))} value={selection} onValueChange={setSelection} disabled={pending}><SelectTrigger aria-label="Clarification choice" className="h-auto w-full min-w-0 whitespace-normal"><SelectValue placeholder="Choose an option" /></SelectTrigger><SelectContent>{question.choices.map(choice => <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>)}</SelectContent></Select>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={pending || (question.field === 'dateRange' ? !from || !to || from > to : !selection)}>Continue</Button></div></form>
}
export function DynamicWorkspace() {
  const { state, draftBuffers } = useWorkspace()
  const [goal, setGoal] = useState('')
  const [restored] = useState(restoreLayout)
  const [response, setResponse] = useState(restored.response)
  const [meeting, setMeeting] = useState(restored.meeting)
  const [persistenceNotice, setPersistenceNotice] = useState(restored.notice)
  const [revision, setRevision] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const workflow = useAdaptiveWorkspace(restored.meeting?.intent)
  const { pending, error, setError, clarification, cancel } = workflow
  const canvas = useRef<HTMLElement | null>(null)
  const [componentState, setComponentState] = useState<Record<string, unknown>>({})
  function changeCommand(open: boolean) { if (!open) workflow.cancel(); setCommandOpen(open) }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (commandOpen) cancel(); setCommandOpen(!commandOpen) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [commandOpen, cancel])
  useEffect(() => {
    if (!commandOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      // The select owns Escape while its portal is open; otherwise cancel the workflow.
      if (event.key !== 'Escape' || document.querySelector('[data-slot="select-content"][data-open]')) return
      event.preventDefault(); event.stopPropagation(); cancel(); setCommandOpen(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [commandOpen, cancel])
  function resetLayout() {
    workflow.reset()
    const cleared = layoutService.clear().status === 'saved'
    setResponse(defaultWorkspace); setMeeting(null); setComponentState({}); setRevision(value => value + 1)
    setGoal(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  async function build(answer?: IntentRequest['clarificationAnswer']) {
    if ((!goal.trim() && !answer) || pending) return
    const result = await workflow.run({ goal: goal.trim(), previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } }, answer)
    if (!result) return
    const saved = result.kind === 'meeting' ? layoutService.saveMeeting(result.session) : layoutService.save(result.response)
    setMeeting(result.kind === 'meeting' ? result.session : null)
    setPersistenceNotice(saved.status === 'saved' ? '' : 'Layout updated, but device storage is unavailable. It may not survive reload.')
    setResponse(result.kind === 'meeting' ? result.session.response : result.response)
    setComponentState({}); setRevision(value => value + 1); setGoal(''); setCommandOpen(false)
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  function generate(event: FormEvent) { event.preventDefault(); void build() }
  const renderer = <Renderer key={revision} library={productivityLibrary} response={response} isStreaming={false} initialState={componentState} onStateUpdate={setComponentState} onAction={() => { setCommandOpen(true); setError('Describe the next change you want to make.') }} />
  return <div className="dynamic-canvas-page"><PageHeaderActions><button className="command-trigger" onClick={() => changeCommand(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={resetLayout}><RotateCcw size={14} /> Reset layout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>
    <main className="generated-canvas" ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace">{persistenceNotice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>}{meeting ? <MeetingScopeProvider key={meeting.meetingId} meetingId={meeting.meetingId} composition={meeting.composition}>{renderer}</MeetingScopeProvider> : renderer}</main>
    <Dialog open={commandOpen} onOpenChange={changeCommand}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a goal or choose the meeting to prepare. Escape cancels and closes this window.</DialogDescription></DialogHeader>{clarification ? <ClarificationForm key={clarification.requestId} question={clarification} pending={pending} onAnswer={answer => void build(answer)} onCancel={() => changeCommand(false)} /> : <form onSubmit={generate} className="goal-form"><div className="goal-input-row"><OrloLogo size={20} /><label htmlFor="command-goal" className="sr-only">Describe the workspace you need</label><input id="command-goal" autoFocus value={goal} onChange={event => setGoal(event.target.value)} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div></form>}{pending && <div className="goal-progress" role="status">Preparing your workspace… <button type="button" onClick={workflow.cancel}>Cancel</button></div>}{error && <p className="goal-error" role="alert">{error}</p>}<div className="command-hint"><span>Demo date · {DEMO_DATE} · Asia/Kolkata</span><span>Esc to close</span></div></DialogContent></Dialog>
  </div>
}
