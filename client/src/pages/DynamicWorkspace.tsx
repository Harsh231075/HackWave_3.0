import { UsageScopeProvider } from '@/state/UsageScope'
import type { UsageLayout } from '@/services/layoutService'
import { usageWorkspaceService } from '@/services'
import { OverdueScopeProvider } from '@/state/OverdueScope'
import type { OverdueLayout } from '@/services/layoutService'
import type { Filters } from '@/domain/types'
import { overdueReviewService } from '@/services'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Renderer } from '@openuidev/react-lang'
import { ArrowUp, Command, LoaderCircle, Mic, Square, MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { layoutService, meetingPreparationService } from '@/services'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useAdaptiveWorkspace, type Clarification } from '@/hooks/useAdaptiveWorkspace'
import { MeetingScopeProvider } from '@/state/MeetingScope'
import { retainMeetingTaskFilters, type MeetingLayout } from '@/services/layoutService'
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
  let usage: UsageLayout | null = null
  if (saved.status === 'found' && saved.value.version === 2 && saved.value.kind === 'usage') {
    const data = usageWorkspaceService.load(saved.value.intent)
    if (data.status === 'found') usage = saved.value
    else return { response: defaultWorkspace, meeting: null, overdue: null, usage: null, notice: 'Saved usage records are unavailable. Showing the default dashboard.' }
  }
  let meeting: MeetingLayout | null = null
  let overdue: OverdueLayout | null = null
  if (saved.status === 'found' && saved.value.version === 2 && saved.value.kind === 'overdue') {
    const review = overdueReviewService.load(saved.value.intent, saved.value.referenceDate)
    if (review.status === 'found') overdue = saved.value
    else return { response: defaultWorkspace, meeting: null, overdue: null, usage: null, notice: 'Saved project records are unavailable. Showing the default dashboard.' }
  }
  if (saved.status === 'found' && saved.value.version === 2 && saved.value.kind === 'meeting') {
    const session = saved.value
    const preparation = meetingPreparationService.load(session.meetingId)
    if (preparation.status === 'found' && validateMeetingComposition(session.composition, { version: 1, requestId: session.composition.requestId, intent: session.intent, preparation: preparation.value, agenda: preparation.value.meeting.agenda }).success) meeting = session
    else return { response: defaultWorkspace, meeting: null, overdue: null, usage: null, notice: 'Saved meeting records are unavailable. Showing the default dashboard.' }
  }
  return { response: saved.status === 'found' ? saved.value.response : defaultWorkspace, meeting, overdue, usage,
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
  const [usage, setUsage] = useState(restored.usage)
  const [overdue, setOverdue] = useState(restored.overdue)
  const [meeting, setMeeting] = useState(restored.meeting)
  const [persistenceNotice, setPersistenceNotice] = useState(restored.notice)
  const [revision, setRevision] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const workflow = useAdaptiveWorkspace(restored.usage?.intent ?? restored.overdue?.intent ?? restored.meeting?.intent, restored.usage?.composition.requestId ?? restored.overdue?.composition.requestId ?? restored.meeting?.composition.requestId, restored.usage?.composition)
  const { pending, error, setError, clarification, cancel } = workflow
  const speech = useSpeechToText({ value: goal, onChange: setGoal, enabled: commandOpen && !pending && !clarification })
  const canvas = useRef<HTMLElement | null>(null)
  const [componentState, setComponentState] = useState<Record<string, unknown>>({})
  function changeCommand(open: boolean) { if (!open) { speech.cancel(); workflow.cancel() }; setCommandOpen(open) }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (commandOpen) { speech.cancel(); cancel() }; setCommandOpen(!commandOpen) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [commandOpen, cancel, speech.cancel])
  useEffect(() => {
    if (!commandOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      // The select owns Escape while its portal is open; otherwise cancel the workflow.
      if (event.key !== 'Escape' || document.querySelector('[data-slot="select-content"][data-open]')) return
      event.preventDefault(); event.stopPropagation(); speech.cancel(); cancel(); setCommandOpen(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [commandOpen, cancel, speech.cancel])
  function resetLayout() {
    speech.cancel()
    workflow.reset()
    const cleared = layoutService.clear().status === 'saved'
    setResponse(defaultWorkspace); setUsage(null); setMeeting(null); setOverdue(null); setComponentState({}); setRevision(value => value + 1)
    setGoal(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  async function build(answer?: IntentRequest['clarificationAnswer']) {
    if ((!goal.trim() && !answer) || pending) return
    speech.cancel()
    const result = await workflow.run({ goal: goal.trim(), previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } }, answer)
    if (!result) return
    if (result.kind === 'meeting') result.session = retainMeetingTaskFilters(meeting, result.session)
    const saved = result.kind === 'usage' ? layoutService.saveUsage(result.session) : result.kind === 'overdue' ? layoutService.saveOverdue(result.session) : result.kind === 'meeting' ? layoutService.saveMeeting(result.session) : layoutService.save(result.response)
    setUsage(result.kind === 'usage' ? result.session : null)
    setOverdue(result.kind === 'overdue' ? result.session : null)
    setMeeting(result.kind === 'meeting' ? result.session : null)
    setPersistenceNotice(saved.status === 'saved' ? '' : 'Layout updated, but device storage is unavailable. It may not survive reload.')
    setResponse(result.kind === 'general' ? result.response : result.session.response)
    setComponentState({}); setRevision(value => value + 1); setGoal(''); setCommandOpen(false)
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  function updateMeetingFilters(filters: Filters) {
    if (!meeting) return
    const session = { ...meeting, taskFilters: filters }
    setMeeting(session)
    const saved = layoutService.saveMeeting(session)
    if (saved.status === 'saved') setPersistenceNotice('')
    else setPersistenceNotice(saved.status === 'invalid' ? 'Choose valid task filter values and an ordered date range. These filters cannot be saved yet.' : 'Meeting task filters updated for this session. Device storage is unavailable.')
  }
  function updateUsageFilters(filters: Filters) {
    if (!usage) return
    const session = { ...usage, taskFilters: filters }
    setUsage(session)
    if (layoutService.saveUsage(session).status !== 'saved') setPersistenceNotice('Usage task filters updated for this session. Device storage is unavailable.')
  }
  function updateReviewFilters(filters: Filters) {
    if (!overdue) return
    const session = { ...overdue, filters }
    setOverdue(session)
    if (layoutService.saveOverdue(session).status !== 'saved') setPersistenceNotice('Review filters updated for this session. Device storage is unavailable.')
  }
  function generate(event: FormEvent) { event.preventDefault(); void build() }
  const renderer = <Renderer key={revision} library={productivityLibrary} response={response} isStreaming={false} initialState={componentState} onStateUpdate={setComponentState} onAction={() => { setCommandOpen(true); setError('Describe the next change you want to make.') }} />
  return <div className="dynamic-canvas-page"><PageHeaderActions><button className="command-trigger" onClick={() => changeCommand(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={resetLayout}><RotateCcw size={14} /> Reset layout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>
    <main className="generated-canvas" ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace">{persistenceNotice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>}{usage ? <UsageScopeProvider session={usage} onFilters={updateUsageFilters}>{renderer}</UsageScopeProvider> : overdue ? <OverdueScopeProvider session={overdue} onFilters={updateReviewFilters}>{renderer}</OverdueScopeProvider> : meeting ? <MeetingScopeProvider key={meeting.meetingId} session={meeting} onFilters={updateMeetingFilters}>{renderer}</MeetingScopeProvider> : renderer}</main>
    <Dialog open={commandOpen} onOpenChange={changeCommand}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a goal or choose the meeting to prepare. Escape cancels and closes this window.</DialogDescription></DialogHeader>{clarification ? <ClarificationForm key={clarification.requestId} question={clarification} pending={pending} onAnswer={answer => void build(answer)} onCancel={() => changeCommand(false)} /> : <form onSubmit={generate} className="goal-form"><div className="goal-input-row"><OrloLogo size={20} /><label htmlFor="command-goal" className="sr-only">Describe the workspace you need</label><input id="command-goal" autoFocus value={goal} onChange={event => { speech.cancel(); setGoal(event.target.value) }} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="button" variant={speech.listening ? 'secondary' : 'ghost'} size="icon" onClick={speech.toggle} disabled={pending || !speech.supported || (!speech.listening && goal.length >= 4000)} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'} aria-pressed={speech.listening} title={speech.supported ? (speech.listening ? 'Stop listening' : 'Speak your goal') : 'Speech input is unavailable in this browser'} className={speech.listening ? 'text-primary ring-2 ring-primary/20' : 'text-muted-foreground'}>{speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div><p className="px-4 pb-2 text-xs text-muted-foreground" role="status" aria-live="polite">{speech.listening ? 'Listening… speak your goal, then tap stop.' : speech.supported ? 'Type or speak using your browser’s speech service. Review before sending.' : 'Speech input is unavailable in this browser. Type your goal instead.'}</p>{speech.error && <p className="px-4 pb-2 text-xs text-destructive" role="alert">{speech.error}</p>}</form>}{pending && <div className="goal-progress" role="status">Preparing your workspace… <button type="button" onClick={workflow.cancel}>Cancel</button></div>}{error && <p className="goal-error" role="alert">{error}</p>}<div className="command-hint"><span>Demo date · {DEMO_DATE} · Asia/Kolkata</span><span>Esc to close</span></div></DialogContent></Dialog>
  </div>
}
