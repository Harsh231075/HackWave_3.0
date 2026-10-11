import { ComponentViewProvider } from '@/state/ComponentViewProvider'
import { resolveComponentIntent } from '@/services/componentIntentService'
import { componentViewSchema, type ComponentView, type ViewBindings } from '@/domain/componentIntent'
import { adaptiveDataService, resourceService } from '@/services'
import { ResponseWidgetsContext } from '@/state/ResponseWidgetsContext'
import { HistoricalWorkspace } from '@/components/conversation/HistoricalWorkspace'
import { captureWorkspaceSnapshot } from '@/lib/conversation/captureWorkspaceSnapshot'
import { ConversationComposer } from '@/components/conversation/ConversationComposer'
import { beginTurn, finishTurn, emptyConversation, archiveWorkspace, conversationService, type Conversation } from '@/services/conversationService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'
import { LiveCalendarWorkspace, type LiveRequest } from '@/components/calendar/LiveCalendarWorkspace'
import { liveCalendarLayoutService } from '@/services/liveCalendarLayoutService'
import { calendarDate, shiftDate } from '@/domain/calendar'
import { liveCalendarGoal, responseWidgetsForPrompt, responseForWidgets, parseLayoutCommand, modifyWidgets, patchWorkspaceResponse, type LayoutCommand } from '@/domain/workspaceCommands'
import { validLayout } from '@/lib/workspace/layoutValidation'
import { meetingCompositionSchema, serializeMeetingComposition } from '@/domain/adaptiveData'
import { overdueCompositionSchema, serializeOverdueComposition } from '@/domain/overdueReview'
import { usageCompositionSchema, serializeUsageComposition } from '@/domain/usageComposition'
import { UsageScopeProvider } from '@/state/UsageScope'
import type { UsageLayout } from '@/services/layoutService'
import { usageWorkspaceService } from '@/services'
import { OverdueScopeProvider } from '@/state/OverdueScope'
import type { OverdueLayout } from '@/services/layoutService'
import type { Filters } from '@/domain/types'
import { overdueReviewService } from '@/services'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
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
  const [resolving, setResolving] = useState(false)
  const resolveRequest = useRef<AbortController | null>(null)
  const [componentQuestion, setComponentQuestion] = useState<{question:string;choices:string[]} | null>(null)
  useEffect(() => () => resolveRequest.current?.abort(), [])
  const [conversation, setConversation] = useState<Conversation>(() => conversationService.load())
  const composer = useRef<HTMLTextAreaElement | null>(null)
  const scrollArea = useRef<HTMLElement | null>(null)
  const scrollContent = useRef<HTMLDivElement | null>(null)
  const followLatest = useRef(true)
  const activeTurn = useRef<string | null>(null)
  useEffect(() => { conversationService.save(conversation) }, [conversation])
  const lastTurnStatus = conversation.turns.at(-1)?.status
  useEffect(() => {
    if (!conversation.active) return
    followLatest.current = true
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: 'instant' })
  }, [conversation.active, conversation.turns.length, conversation.hasWorkspace, lastTurnStatus])
  useEffect(() => {
    if (!conversation.active || !scrollContent.current) return
    const observer = new ResizeObserver(() => { if (followLatest.current && scrollArea.current) scrollArea.current.scrollTop = scrollArea.current.scrollHeight })
    observer.observe(scrollContent.current)
    return () => observer.disconnect()
  }, [conversation.active])
  useEffect(() => { if (conversation.active) requestAnimationFrame(() => composer.current?.focus({ preventScroll: true })) }, [conversation.active])
  const calendar = useGoogleCalendar()
  const [liveRequest, setLiveRequest] = useState<LiveRequest | null>(() => liveCalendarLayoutService.load())
  const [calendarSettings, setCalendarSettings] = useState(() => ['permission-missing', 'state-error', 'connect-error'].includes(new URL(window.location.href).searchParams.get('calendar') ?? ''))
  const [useDemoCalendar, setUseDemoCalendar] = useState(false)
  const [layoutUndo, setLayoutUndo] = useState<Array<{ response: string; meeting: MeetingLayout | null; overdue: OverdueLayout | null; usage: UsageLayout | null; live: LiveRequest | null }>>([])
  const updateLive = useCallback((request: LiveRequest) => { setLiveRequest(request); liveCalendarLayoutService.save(request) }, [])
  const [restored] = useState(restoreLayout)
  const [response, setResponse] = useState(restored.response)
  const [usage, setUsage] = useState(restored.usage)
  const [overdue, setOverdue] = useState(restored.overdue)
  const [meeting, setMeeting] = useState(restored.meeting)
  const [persistenceNotice, setPersistenceNotice] = useState(() => {
    const outcome = new URL(window.location.href).searchParams.get('calendar')
    if (outcome === 'permission-missing') return 'Google sign-in succeeded, but calendar permission was not granted. Connect again and select permission to view your calendar events.'
    if (outcome === 'state-error') return 'Your Google connection attempt expired or could not be verified. Start again from Calendar connection.'
    if (outcome === 'connect-error') return 'Google Calendar could not connect. Check your account and try again from Calendar connection.'
    return outcome === 'denied' ? 'Google Calendar permission was declined. Your workspace and notes are unchanged.' : outcome === 'connected' ? 'Google Calendar connected. Your saved meeting goal is ready to continue.' : restored.notice
  })
  const [revision, setRevision] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const workflow = useAdaptiveWorkspace(restored.usage?.intent ?? restored.overdue?.intent ?? restored.meeting?.intent, restored.usage?.composition.requestId ?? restored.overdue?.composition.requestId ?? restored.meeting?.composition.requestId, restored.usage?.composition)
  const { pending: workflowPending, error, setError, clarification, cancel } = workflow
  const pending = workflowPending || resolving
  const speech = useSpeechToText({ value: goal, onChange: setGoal, enabled: (commandOpen || conversation.active) && !pending && !clarification })
  const canvas = useRef<HTMLElement | null>(null)
  const [componentState, setComponentState] = useState<Record<string, unknown>>({})
  useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get('calendar')
    if (!outcome) return
    url.searchParams.delete('calendar')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])
  const cancelSpeech = speech.cancel
  function changeCommand(open: boolean) {
    if (conversation.active && open) { requestAnimationFrame(() => composer.current?.focus()); return }
    if (!open) { speech.cancel(); workflow.cancel() }
    setCommandOpen(open)
  }
  function completeTurn(id: string, status: Conversation['turns'][number]['status'], reply: string, visibleWidgets?: string[], componentPlan?: ComponentView) { setConversation(current => { const next = finishTurn(current, id, status, reply, visibleWidgets); return componentPlan ? {...next,turns:next.turns.map(turn=>turn.id===id?{...turn,componentPlan}:turn)} : next }) }
  function stopConversation() { speech.cancel(); resolveRequest.current?.abort(); resolveRequest.current=null;setResolving(false);setComponentQuestion(null);cancel(); if (activeTurn.current) completeTurn(activeTurn.current, 'cancelled', 'Stopped. Your existing workspace and edits are kept.'); activeTurn.current = null }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (conversation.active) { composer.current?.focus(); return }; if (commandOpen) { cancelSpeech(); cancel() }; setCommandOpen(!commandOpen) }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [commandOpen, conversation.active, cancel, cancelSpeech])
  useEffect(() => {
    if (!commandOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      // The select owns Escape while its portal is open; otherwise cancel the workflow.
      if (event.key !== 'Escape' || document.querySelector('[data-slot="select-content"][data-open]')) return
      event.preventDefault(); event.stopPropagation(); cancelSpeech(); cancel(); setCommandOpen(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [commandOpen, cancel, cancelSpeech])
  function resetLayout() {
    speech.cancel()
    resolveRequest.current?.abort(); resolveRequest.current=null;setResolving(false);setComponentQuestion(null)
    workflow.reset()
    activeTurn.current = null; setConversation(emptyConversation()); conversationService.clear()
    setLiveRequest(null); liveCalendarLayoutService.clear(); setLayoutUndo([])
    const cleared = layoutService.clear().status === 'saved'
    setResponse(defaultWorkspace); setUsage(null); setMeeting(null); setOverdue(null); setComponentState({}); setRevision(value => value + 1)
    setGoal(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  function rememberLayout() { setLayoutUndo(history => [...history, { response, meeting, overdue, usage, live: liveRequest }].slice(-20)) }
  function changeLayout(command: LayoutCommand) {
    rememberLayout()
    try {
      if (liveRequest) {
        if (liveRequest.kind !== 'prepare' || !liveRequest.eventId) throw new Error('Choose a meeting before changing its preparation layout.')
        const widget = command.widget === 'outline' ? 'outline' : command.widget === 'context' ? 'details' : command.widget
        if (!['details', 'outline', 'calendar'].includes(widget)) throw new Error('This real-calendar preparation can show meeting details, notes and calendar. Project records are not linked yet.')
        const list = modifyWidgets((liveRequest.widgets ?? ['details', 'outline', 'calendar']).map(type => ({ type, span: 'full' })), { ...command, widget }, () => ({ type: widget, span: command.span }), ['details', 'outline'])
        updateLive({ ...liveRequest, widgets: list.map(w => w.type), span: command.span })
      } else if (meeting) {
        const widgets = modifyWidgets(meeting.composition.widgets, command, () => ({ ...meeting.composition.widgets[0], type: command.widget as typeof meeting.composition.widgets[number]['type'], span: command.span, reason: 'Added to support your current meeting preparation without changing its scope.' }), ['context', 'outline'])
        const composition = meetingCompositionSchema.parse({ ...meeting.composition, widgets })
        const next = { ...meeting, composition, response: serializeMeetingComposition(composition) }
        if (layoutService.saveMeeting(next).status !== 'saved') setPersistenceNotice('Layout updated for this session. Device storage is unavailable.')
        setMeeting(next); setResponse(next.response)
      } else if (usage) {
        const widgets = modifyWidgets(usage.composition.widgets, command, () => ({ ...usage.composition.widgets[0], type: command.widget as typeof usage.composition.widgets[number]['type'], span: command.span, reason: 'Added to support the current investigation while keeping its scope.' }), ['context', 'usage'])
        const composition = usageCompositionSchema.parse({ ...usage.composition, widgets })
        const next = { ...usage, composition, response: serializeUsageComposition(composition) }
        layoutService.saveUsage(next); setUsage(next); setResponse(next.response)
      } else if (overdue) {
        const widgets = modifyWidgets(overdue.composition.widgets, command, () => ({ ...overdue.composition.widgets[0], type: command.widget as typeof overdue.composition.widgets[number]['type'], span: command.span, reason: 'Added alongside your current project review without changing project records.' }), ['context', 'tasks'])
        const composition = overdueCompositionSchema.parse({ ...overdue.composition, widgets })
        const next = { ...overdue, composition, response: serializeOverdueComposition(composition) }
        layoutService.saveOverdue(next); setOverdue(next); setResponse(next.response)
      } else {
        const next = !conversation.hasWorkspace && command.action === 'add' ? `root = Card([Workspace([WorkspaceWidget("${command.widget}", "${command.span}")])])` : patchWorkspaceResponse(response, command)
        if (!validLayout(next)) throw new Error('This layout change could not be validated. Try a different widget.')
        layoutService.save(next); setResponse(next)
      }
      setGoal(''); setCommandOpen(false); setError(''); return true
    } catch (failure) { setLayoutUndo(history => history.slice(0, -1)); setError(failure instanceof Error && failure.name !== 'ZodError' ? failure.message : 'That widget is not available for the current goal. Try adding the calendar or changing its width.'); return false }
  }
  function undoLayout() {
    const previous = layoutUndo.at(-1)
    if (!previous) return
    setResponse(previous.response); setMeeting(previous.meeting); setOverdue(previous.overdue); setUsage(previous.usage); setLiveRequest(previous.live)
    if (previous.live) liveCalendarLayoutService.save(previous.live); else liveCalendarLayoutService.clear()
    if (previous.meeting) layoutService.saveMeeting(previous.meeting); else if (previous.usage) layoutService.saveUsage(previous.usage); else if (previous.overdue) layoutService.saveOverdue(previous.overdue); else layoutService.save(previous.response)
    setLayoutUndo(history => history.slice(0, -1))
  }
  async function build(answer?: IntentRequest['clarificationAnswer'], demo = false, retryPrompt?: string) {
    const submittedGoal = answer?.originalGoal ?? retryPrompt ?? goal.trim()
    if (!submittedGoal || pending || resolveRequest.current) return
    speech.cancel()
    const id = crypto.randomUUID()
    activeTurn.current = id
    const answerText = answer ? answer.field === 'dateRange' ? `${answer.dateRange.from} through ${answer.dateRange.to}` : clarification?.choices.find(choice => choice.id === answer.selectedId)?.label ?? 'Use the selected option' : submittedGoal
    const previousTurn = conversation.workspaceTurnId ?? [...conversation.turns].reverse().find(turn => turn.status === 'ready')?.id
    const previousSnapshot = canvas.current && conversation.hasWorkspace ? { ...captureWorkspaceSnapshot(canvas.current), ...(calendar.connection?.accountId && (liveRequest || currentResponseTurn?.componentPlan?.bindings.draftKey?.startsWith('google-preparation:') || (currentResponseWidgets ? currentResponseWidgets.some(widget=>['calendar','meetings','availability'].includes(widget)) : /WorkspaceWidget\(\s*"calendar"/.test(response))) ? { accountId: calendar.connection.accountId } : {}) } : null
    setConversation(current => beginTurn(previousTurn && previousSnapshot ? archiveWorkspace(current, previousTurn, previousSnapshot) : current, id, answerText))
    setGoal(''); setCommandOpen(false); setError(''); setComponentQuestion(null)
    if (!answer) {
      const modification = parseLayoutCommand(submittedGoal)
      if (modification && (modification.action === 'remove' || modification.action === 'resize' && /width|wide|narrow|resize|expand/i.test(submittedGoal))) {
        const changed = changeLayout(modification)
        const title = modification.widget === 'tasks' ? 'tasks' : modification.widget === 'outline' ? 'notes' : modification.widget
        const reply = modification.action === 'remove' ? `${title[0].toUpperCase() + title.slice(1)} removed from the working layout.` : `Here ${title === 'tasks' || title === 'notes' ? 'are' : 'is'} your ${title}.`
        completeTurn(id, changed ? 'ready' : 'error', changed ? reply : workflow.getOutcome().error, changed ? modification.action === 'remove' ? [] : [modification.widget] : undefined, changed && modification.action !== 'remove' && currentResponseTurn?.componentPlan ? {...currentResponseTurn.componentPlan,widgets:[modification.widget as ComponentView['widgets'][number]]} : undefined)
        return
      }
      const controller = new AbortController(); resolveRequest.current=controller;setResolving(true)
      let resolved
      try {
        const records=adaptiveDataService.snapshot()
        resolved=await resolveComponentIntent({goal:submittedGoal,referenceDate:calendarDate(undefined,calendar.timezone),timezone:calendar.timezone,previous:currentResponseTurn?.componentPlan,
          catalog:{owners:[...new Set(state.tasks.map(task=>task.owner))],projects:records?.projects??[],clients:records?.clients??[],
            draftKeys:Object.keys({...state.drafts,...draftBuffers}).filter(key=>!key.startsWith('google-preparation:')||!!calendar.connection?.accountId&&key.startsWith('google-preparation:'+calendar.connection.accountId+':')),
            topics:[...new Set(resourceService.list().map(resource=>resource.context))]},
        },controller.signal)
      } catch(failure) {if(!controller.signal.aborted)completeTurn(id,'error',failure instanceof Error?failure.message:'Unable to resolve your request.');return}
      finally {if(resolveRequest.current===controller){resolveRequest.current=null;setResolving(false)}}
      if(controller.signal.aborted||activeTurn.current!==id)return
      if(resolved.action==='clarify'){setComponentQuestion(resolved);completeTurn(id,'clarification',resolved.question);return}
      if(resolved.action==='view'){
        const next=responseForWidgets('',resolved.widgets)
        if(!validLayout(next)){completeTurn(id,'error','The selected components could not be rendered. Try again.');return}
        rememberLayout();setLiveRequest(null);liveCalendarLayoutService.clear();setUsage(null);setMeeting(null);setOverdue(null);setResponse(next);layoutService.save(next)
        setComponentState({});setRevision(value=>value+1)
        completeTurn(id,'ready',resolved.reply,resolved.widgets,resolved)
        return
      }
      const liveKind = !demo && !useDemoCalendar ? resolved.kind==='meeting_preparation'?'prepare':resolved.kind==='meeting_scheduling'?'schedule':liveCalendarGoal(submittedGoal) : null
      if (liveKind) {
        rememberLayout()
        const today = calendarDate(undefined, calendar.timezone)
        const date = submittedGoal.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? shiftDate(today, /tomorrow/i.test(submittedGoal) ? 1 : 0)
        updateLive({ kind: liveKind, goal: submittedGoal, date })
        calendar.setDate(date); completeTurn(id, 'ready', liveKind === 'schedule' ? 'Let’s arrange your meeting. Enter the details below, choose a time and review before creating it.' : 'Let’s find the meeting you want to prepare. Choose it below to open your preparation tools.'); return
      }
    }
    const result = await workflow.run({ goal: submittedGoal, previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } }, answer)
    if (activeTurn.current !== id) return
    if (!result) { const outcome = workflow.getOutcome(); completeTurn(id, outcome.clarification ? 'clarification' : 'error', outcome.clarification?.question ?? outcome.error ?? 'Your workspace could not be prepared. Try again.'); return }
    setLiveRequest(null); liveCalendarLayoutService.clear(); setUseDemoCalendar(false)
    if (result.kind === 'meeting') result.session = retainMeetingTaskFilters(meeting, result.session)
    const saved = result.kind === 'usage' ? layoutService.saveUsage(result.session) : result.kind === 'overdue' ? layoutService.saveOverdue(result.session) : result.kind === 'meeting' ? layoutService.saveMeeting(result.session) : layoutService.save(result.response)
    setUsage(result.kind === 'usage' ? result.session : null)
    setOverdue(result.kind === 'overdue' ? result.session : null)
    setMeeting(result.kind === 'meeting' ? result.session : null)
    setPersistenceNotice(saved.status === 'saved' ? '' : 'Layout updated, but device storage is unavailable. It may not survive reload.')
    setResponse(result.kind === 'general' ? result.response : result.session.response)
    setComponentState({}); setRevision(value => value + 1); setGoal(''); setCommandOpen(false)
    completeTurn(id, 'ready', 'Your workspace is ready. Use the tools below, or send a follow-up to change the layout.')
    requestAnimationFrame(() => composer.current?.focus({ preventScroll: true }))
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
  function updateComponentBindings(bindings: Partial<ViewBindings>) {
    if(!currentResponseTurn?.componentPlan)return
    const plan=componentViewSchema.parse({...currentResponseTurn.componentPlan,bindings:{...currentResponseTurn.componentPlan.bindings,...bindings}})
    setConversation(current=>({...current,turns:current.turns.map(turn=>turn.id===workspaceTurnId?{...turn,componentPlan:plan}:turn)}))
  }
  function generate(event: FormEvent) { event.preventDefault(); void build() }
  const workspaceTurnId = conversation.workspaceTurnId ?? [...conversation.turns].reverse().find(turn => turn.status === 'ready')?.id
  const currentResponseTurn = conversation.turns.find(turn => turn.id === workspaceTurnId)
  const currentResponseWidgets = currentResponseTurn?.visibleWidgets ?? (currentResponseTurn ? responseWidgetsForPrompt(currentResponseTurn.prompt) : undefined)
  const renderer = <Renderer key={revision} library={productivityLibrary} response={currentResponseWidgets?.length ? responseForWidgets(response, currentResponseWidgets) : response} isStreaming={false} initialState={componentState} onStateUpdate={setComponentState} onAction={() => { setCommandOpen(true); setError('Describe the next change you want to make.') }} />
  return <div className={conversation.active ? "dynamic-canvas-page flex h-[calc(100dvh-64px)] flex-col max-sm:h-[calc(100dvh-60px)]" : "dynamic-canvas-page"} data-conversation-active={conversation.active}><PageHeaderActions><button className="command-trigger" onClick={() => changeCommand(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setCalendarSettings(true)}>Google Calendar connection</DropdownMenuItem><DropdownMenuItem disabled={!layoutUndo.length} onClick={undoLayout}>Undo layout change</DropdownMenuItem><DropdownMenuItem onClick={resetLayout}><RotateCcw size={14} /> Reset layout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>

    {conversation.active ? <>
      <main ref={scrollArea} onWheel={() => { followLatest.current = false }} onTouchStart={() => { followLatest.current = false }} onScroll={() => { const area = scrollArea.current; if (area && area.scrollHeight - area.scrollTop - area.clientHeight < 80) followLatest.current = true }} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="Workspace conversation">
        <div ref={scrollContent} className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8">
          {persistenceNotice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>}
          <div className="space-y-6" aria-label="Conversation history">{conversation.turns.map(turn => <div key={turn.id} className="space-y-3">
            <div className="flex justify-end"><p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-md bg-muted px-4 py-3 text-sm text-foreground">{turn.prompt}</p></div>
            <div className="flex items-start gap-3"><span className="mt-1 shrink-0"><OrloLogo size={22} /></span><div className="min-w-0 flex-1"><p className={`text-sm leading-6 ${turn.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} role={turn.status === 'error' ? 'alert' : turn.status === 'pending' ? 'status' : undefined}>{turn.status === 'pending' && <LoaderCircle size={15} className="mr-2 inline animate-spin" />}{turn.reply}</p>{(turn.status === 'error' || turn.status === 'cancelled') && <Button variant="ghost" size="sm" disabled={pending} onClick={() => void build(undefined, false, turn.prompt)}>Try again</Button>}</div></div>
            {turn.snapshot && turn.id !== workspaceTurnId && <HistoricalWorkspace snapshot={turn.snapshot} turnId={turn.id} accountId={calendar.connection?.accountId} />}
          {turn.id === workspaceTurnId && conversation.hasWorkspace && turn.status === 'ready' && (turn.visibleWidgets ?? responseWidgetsForPrompt(turn.prompt))?.length !== 0 && <section ref={canvas} className="outline-none" tabIndex={-1} aria-label="Active workspace"><ResponseWidgetsContext.Provider value={turn.visibleWidgets ?? responseWidgetsForPrompt(turn.prompt) ?? null}>{turn.componentPlan ? <ComponentViewProvider key={turn.id} plan={turn.componentPlan} onChange={updateComponentBindings}>{renderer}</ComponentViewProvider> : <>{liveRequest ? <LiveCalendarWorkspace request={liveRequest} onChange={updateLive} onClose={() => { setLiveRequest(null); liveCalendarLayoutService.clear() }} onDemo={() => { setUseDemoCalendar(true); const original = liveRequest.goal; setLiveRequest(null); liveCalendarLayoutService.clear(); setGoal(original); requestAnimationFrame(() => composer.current?.focus()); setError('Demo records selected. Send a specific saved meeting or project name.'); }} /> : usage ? <UsageScopeProvider session={usage} onFilters={updateUsageFilters}>{renderer}</UsageScopeProvider> : overdue ? <OverdueScopeProvider session={overdue} onFilters={updateReviewFilters}>{renderer}</OverdueScopeProvider> : meeting ? <MeetingScopeProvider key={meeting.meetingId} session={meeting} onFilters={updateMeetingFilters}>{renderer}</MeetingScopeProvider> : renderer}</>}</ResponseWidgetsContext.Provider></section>}
            {turn.id === conversation.turns.at(-1)?.id && componentQuestion && <div className="flex flex-wrap gap-2">{componentQuestion.choices.map(choice=><Button key={choice} variant="outline" size="sm" disabled={pending} onClick={()=>void build(undefined,false,choice)}>{choice}</Button>)}</div>}
            {turn.id === conversation.turns.at(-1)?.id && clarification && <section className="rounded-2xl border border-border bg-card p-4" aria-label="Clarify your goal"><ClarificationForm key={clarification.requestId} question={clarification} pending={pending} onAnswer={answer => void build(answer)} onCancel={stopConversation} /></section>}
          </div>)}</div>
          {calendarSettings && <section className="space-y-3"><GoogleCalendarConnection /><Button variant="ghost" size="sm" onClick={() => setCalendarSettings(false)}>Hide connection settings</Button></section>}

          {error && conversation.turns.at(-1)?.status !== 'error' && <p className="text-sm text-destructive" role="alert">{error}</p>}
        </div>
      </main>
      <ConversationComposer value={goal} onChange={setGoal} onSubmit={() => void build()} pending={pending} onStop={stopConversation} inputRef={composer} speech={speech} />
    </> : <main className="generated-canvas" ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace">{persistenceNotice && <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>} {liveRequest ? <LiveCalendarWorkspace request={liveRequest} onChange={updateLive} onClose={() => { setLiveRequest(null); liveCalendarLayoutService.clear() }} onDemo={() => { setUseDemoCalendar(true); const original = liveRequest.goal; setLiveRequest(null); liveCalendarLayoutService.clear(); setGoal(original); requestAnimationFrame(() => composer.current?.focus()); setError('Demo records selected. Send a specific saved meeting or project name.'); }} /> : usage ? <UsageScopeProvider session={usage} onFilters={updateUsageFilters}>{renderer}</UsageScopeProvider> : overdue ? <OverdueScopeProvider session={overdue} onFilters={updateReviewFilters}>{renderer}</OverdueScopeProvider> : meeting ? <MeetingScopeProvider key={meeting.meetingId} session={meeting} onFilters={updateMeetingFilters}>{renderer}</MeetingScopeProvider> : renderer}</main>}
    {!conversation.active && <Dialog open={calendarSettings} onOpenChange={setCalendarSettings}><DialogContent><DialogHeader><DialogTitle>Calendar connection</DialogTitle><DialogDescription>Connect Google to read real events. Event creation asks for additional permission and confirmation.</DialogDescription></DialogHeader><GoogleCalendarConnection /></DialogContent></Dialog>}
    {!conversation.active && <Dialog open={commandOpen} onOpenChange={changeCommand}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a goal or choose the meeting to prepare. Escape cancels and closes this window.</DialogDescription></DialogHeader>{clarification ? <ClarificationForm key={clarification.requestId} question={clarification} pending={pending} onAnswer={answer => void build(answer)} onCancel={() => changeCommand(false)} /> : <form onSubmit={generate} className="goal-form"><div className="goal-input-row"><OrloLogo size={20} /><label htmlFor="command-goal" className="sr-only">Describe the workspace you need</label><input id="command-goal" autoFocus value={goal} onChange={event => { speech.cancel(); setGoal(event.target.value) }} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="button" variant={speech.listening ? 'secondary' : 'ghost'} size="icon" onClick={speech.toggle} disabled={pending || !speech.supported || (!speech.listening && goal.length >= 4000)} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'} aria-pressed={speech.listening} title={speech.supported ? (speech.listening ? 'Stop listening' : 'Speak your goal') : 'Speech input is unavailable in this browser'} className={speech.listening ? 'text-primary ring-2 ring-primary/20' : 'text-muted-foreground'}>{speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div><p className="px-4 pb-2 text-xs text-muted-foreground" role="status" aria-live="polite">{speech.listening ? 'Listening… speak your goal, then tap stop.' : speech.supported ? 'Type or speak using your browser’s speech service. Review before sending.' : 'Speech input is unavailable in this browser. Type your goal instead.'}</p>{speech.error && <p className="px-4 pb-2 text-xs text-destructive" role="alert">{speech.error}</p>}</form>}{pending && <div className="goal-progress" role="status">Preparing your workspace… <button type="button" onClick={workflow.cancel}>Cancel</button></div>}{error && <p className="goal-error" role="alert">{error}</p>}<div className="command-hint"><span>{calendar.connection?.connected ? `Live calendar · ${calendar.timezone}` : `Demo date · ${DEMO_DATE} · Connect Google for real meetings`}</span><span>Esc to close</span></div></DialogContent></Dialog>}
  </div>
}
