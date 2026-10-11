import { managedWorkspaceService, updateManagedViews, type ManagedItem } from '@/domain/managedWorkspace'
import { applyWorkspaceOperations, localManagement, namedWidgets } from '@/domain/workspaceManagement'
import { widgetTypes, type WidgetType } from '@/lib/workspace/config'
import { registry } from '@/lib/workspace/registry'
import { WidgetFrame } from '@/lib/workspace/WorkspaceRenderer'
import { ComponentViewProvider } from '@/state/ComponentViewProvider'
import { resolveComponentIntent } from '@/services/componentIntentService'
import { componentViewSchema, type ComponentView, type ComponentResolution, type ViewBindings, fallbackComponentIntent } from '@/domain/componentIntent'
import { adaptiveDataService, resourceService } from '@/services'
import { beginTurn, finishTurn, emptyConversation, conversationService, type Conversation } from '@/services/conversationService'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'
import { LiveCalendarWorkspace, type LiveRequest } from '@/components/calendar/LiveCalendarWorkspace'
import { liveCalendarLayoutService } from '@/services/liveCalendarLayoutService'
import { calendarDate, shiftDate } from '@/domain/calendar'
import { liveCalendarGoal } from '@/domain/workspaceCommands'
import { UsageScopeProvider } from '@/state/UsageScope'
import type { UsageLayout } from '@/services/layoutService'
import { usageWorkspaceService } from '@/services'
import { OverdueScopeProvider } from '@/state/OverdueScope'
import type { OverdueLayout } from '@/services/layoutService'
import { overdueReviewService } from '@/services'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { ArrowUp, Command, LoaderCircle, Mic, Square, MoreHorizontal, RotateCcw, X } from 'lucide-react'
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
  const [items,setItems]=useState<ManagedItem[]>(()=>{
    const saved=managedWorkspaceService.load();if(saved)return saved
    const legacy=restoreLayout(),live=liveCalendarLayoutService.load()
    const plan=conversation.turns.find(t=>t.id===conversation.workspaceTurnId)?.componentPlan
    const scope=legacy.usage??legacy.overdue??legacy.meeting
    const ids=scope?scope.composition.widgets.map(w=>w.type):(plan?.widgets??[...legacy.response.matchAll(/WorkspaceWidget\(\s*"([a-z-]+)"/g)].map(m=>m[1]))
    const result:ManagedItem[]=ids.filter((id):id is WidgetType=>widgetTypes.includes(id as WidgetType)).map(id=>({id,span:([...legacy.response.matchAll(/WorkspaceWidget\(\s*"([a-z-]+)"\s*,\s*"(full|wide|narrow)"/g)].find(m=>m[1]===id)?.[2]??'full') as ManagedItem['span'],plan,meeting:legacy.meeting??undefined,usage:legacy.usage??undefined,overdue:legacy.overdue??undefined}))
    if(live){const index=result.findIndex(item=>item.id==='meetings');const item:ManagedItem={id:'meetings',span:'full',live};if(index<0)result.push(item);else result[index]=item}
    return result
  })
  useEffect(()=>{if(conversation.active)managedWorkspaceService.save(items)},[items,conversation.active])
  const scrollArea = useRef<HTMLElement | null>(null)
  const activeTurn = useRef<string | null>(null)
  useEffect(() => { conversationService.save(conversation) }, [conversation])
  const calendar = useGoogleCalendar()
  const [liveRequest, setLiveRequest] = useState<LiveRequest | null>(() => liveCalendarLayoutService.load())
  const [calendarSettings, setCalendarSettings] = useState(() => ['permission-missing', 'state-error', 'connect-error'].includes(new URL(window.location.href).searchParams.get('calendar') ?? ''))
  const [useDemoCalendar, setUseDemoCalendar] = useState(false)
  const [layoutUndo, setLayoutUndo] = useState<Array<{ response: string; meeting: MeetingLayout | null; overdue: OverdueLayout | null; usage: UsageLayout | null; live: LiveRequest | null; items:ManagedItem[]; conversation: Conversation; componentState: Record<string, unknown> }>>([])
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
  const [, setRevision] = useState(0)
  const [commandOpen, setCommandOpen] = useState(false)
  const workflow = useAdaptiveWorkspace(restored.usage?.intent ?? restored.overdue?.intent ?? restored.meeting?.intent, restored.usage?.composition.requestId ?? restored.overdue?.composition.requestId ?? restored.meeting?.composition.requestId, restored.usage?.composition)
  const { pending: workflowPending, error, setError, clarification, cancel } = workflow
  const pending = workflowPending || resolving
  const speech = useSpeechToText({ value: goal, onChange: setGoal, enabled: commandOpen && !pending && !clarification })
  const canvas = useRef<HTMLElement | null>(null)
  const [componentState, setComponentState] = useState<Record<string, unknown>>({})
  useEffect(() => {
    const url = new URL(window.location.href)
    const outcome = url.searchParams.get('calendar')
    if (!outcome) return
    url.searchParams.delete('calendar')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [])
  function changeCommand(open: boolean) {
    if (!open) { speech.cancel(); if (pending) stopConversation() }
    setCommandOpen(open)
  }
  function completeTurn(id: string, status: Conversation['turns'][number]['status'], reply: string, visibleWidgets?: string[], componentPlan?: ComponentView) { setConversation(current => { const next = finishTurn(current, id, status, reply, visibleWidgets); return componentPlan ? {...next,turns:next.turns.map(turn=>turn.id===id?{...turn,componentPlan}:turn)} : next }) }
  function stopConversation() { speech.cancel(); resolveRequest.current?.abort(); resolveRequest.current=null;setResolving(false);setComponentQuestion(null);cancel(); if (activeTurn.current) completeTurn(activeTurn.current, 'cancelled', 'Stopped. Your existing workspace and edits are kept.'); activeTurn.current = null }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (commandOpen) { changeCommand(false) } else { setCommandOpen(true) } }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  })
  useEffect(() => {
    if (!commandOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      // The select owns Escape while its portal is open; otherwise cancel the workflow.
      if (event.key !== 'Escape' || document.querySelector('[data-slot="select-content"][data-open]')) return
      event.preventDefault(); event.stopPropagation(); changeCommand(false)
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  })
  function resetLayout() {
    speech.cancel()
    resolveRequest.current?.abort(); resolveRequest.current=null;setResolving(false);setComponentQuestion(null)
    workflow.reset()
    activeTurn.current = null; setConversation(emptyConversation()); conversationService.clear()
    setLiveRequest(null); liveCalendarLayoutService.clear(); setLayoutUndo([])
    const cleared = layoutService.clear().status === 'saved'
    setResponse(defaultWorkspace); setUsage(null); setMeeting(null); setOverdue(null); setComponentState({}); setRevision(value => value + 1)
    setItems([]);managedWorkspaceService.save([])
    setGoal(''); setCommandOpen(false)
    setPersistenceNotice(cleared ? '' : 'Layout reset for now. Device storage could not be cleared; the previous layout may return after reload.')
    requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  function rememberLayout() { setLayoutUndo(history => [...history, { response, meeting, overdue, usage, live: liveRequest, items, conversation, componentState }].slice(-20)) }
  function undoLayout() {
    const previous = layoutUndo.at(-1)
    if (!previous) return
    setResponse(previous.response); setMeeting(previous.meeting); setOverdue(previous.overdue); setUsage(previous.usage); setLiveRequest(previous.live)
    if (previous.live) liveCalendarLayoutService.save(previous.live); else liveCalendarLayoutService.clear()
    if (previous.meeting) layoutService.saveMeeting(previous.meeting); else if (previous.usage) layoutService.saveUsage(previous.usage); else if (previous.overdue) layoutService.saveOverdue(previous.overdue); else layoutService.save(previous.response)
    setItems(previous.items); setConversation(previous.conversation); setComponentState(previous.componentState)
    setLayoutUndo(history => history.slice(0, -1))
  }
  async function build(answer?: IntentRequest['clarificationAnswer'], demo = false, retryPrompt?: string) {
    const submittedGoal = answer?.originalGoal ?? retryPrompt ?? goal.trim()
    if (!submittedGoal || pending || resolveRequest.current) return
    speech.cancel()
    const id = crypto.randomUUID()
    activeTurn.current = id
    const answerText = answer ? answer.field === 'dateRange' ? `${answer.dateRange.from} through ${answer.dateRange.to}` : clarification?.choices.find(choice => choice.id === answer.selectedId)?.label ?? 'Use the selected option' : submittedGoal
    setConversation(current => beginTurn(current, id, answerText))
    setGoal(''); setCommandOpen(false); setError(''); setComponentQuestion(null)
    if (!answer) {
      const controller = new AbortController(); resolveRequest.current=controller;setResolving(true)
      let resolved:ComponentResolution|null = localManagement(submittedGoal)
      try {
        const records=adaptiveDataService.snapshot()
        resolved??=await resolveComponentIntent({workspaceWidgets:items.map(item=>item.id),componentPlans:items.flatMap(item=>item.plan?[item.plan]:[]),goal:submittedGoal,referenceDate:calendarDate(undefined,calendar.timezone),timezone:calendar.timezone,previous:items.find(item=>namedWidgets(submittedGoal).includes(item.id)||/priority|pending|blocked|completed|kanban/i.test(submittedGoal)&&item.id==='tasks')?.plan??currentResponseTurn?.componentPlan,
          catalog:{owners:[...new Set(state.tasks.map(task=>task.owner))],projects:records?.projects??[],clients:records?.clients??[],
            draftKeys:Object.keys({...state.drafts,...draftBuffers}).filter(key=>!key.startsWith('google-preparation:')||!!calendar.connection?.accountId&&key.startsWith('google-preparation:'+calendar.connection.accountId+':')),
            topics:[...new Set(resourceService.list().map(resource=>resource.context))]},
        },controller.signal)
      } catch(failure) {if(!controller.signal.aborted)completeTurn(id,'error',failure instanceof Error?failure.message:'Unable to resolve your request.');return}
      finally {if(resolveRequest.current===controller){resolveRequest.current=null;setResolving(false)}}
      if(controller.signal.aborted||activeTurn.current!==id||!resolved)return
      if(resolved.action==='clarify'){setComponentQuestion(resolved);completeTurn(id,'clarification',resolved.question);setCommandOpen(true);return}
      if(resolved.action==='manage'){
        try {
          const addition=submittedGoal.split(/\s+(?:and|then|and then)\s+(?:add|show)(?:\s+me)?\s+/i).at(-1)??submittedGoal
          const plan=fallbackComponentIntent({goal:addition,referenceDate:calendarDate(undefined,calendar.timezone),timezone:calendar.timezone,catalog:{owners:[...new Set(state.tasks.map(task=>task.owner))],projects:adaptiveDataService.snapshot()?.projects??[],clients:adaptiveDataService.snapshot()?.clients??[],draftKeys:[],topics:[]}})
          const create=(id:WidgetType):ManagedItem=>({id,span:'full',plan:plan.action==='view'?{...plan,widgets:[id]}:undefined})
          let next=applyWorkspaceOperations(items,resolved.operations,create)
          const added=resolved.operations.flatMap(op=>op.type==='add'?op.widgets:[])
          if(added.length&&plan.action==='view')next=updateManagedViews(next,{...plan,widgets:[...new Set(added)]},addition)
          rememberLayout();setItems(next)
          const clearsPanels=resolved.operations.some(op=>op.type==='clear'||op.type==='keep')
          if(clearsPanels){setLiveRequest(null);liveCalendarLayoutService.clear();setUsage(null);setMeeting(null);setOverdue(null)}
          completeTurn(id,'ready',next.length?resolved.reply:'Workspace cleared. Press Ctrl / Cmd + K to add components.',next.map(item=>item.id))
        }catch(failure){completeTurn(id,'error',failure instanceof Error?failure.message:'The workspace could not be changed.')}
        return
      }
      if(resolved.action==='view'){
        const view=resolved
        rememberLayout()
        setItems(current=>updateManagedViews(current,view,submittedGoal))
        completeTurn(id,'ready',resolved.reply,view.widgets,resolved)
        return
      }
      const liveKind = !demo && !useDemoCalendar ? resolved.kind==='meeting_preparation'?'prepare':resolved.kind==='meeting_scheduling'?'schedule':liveCalendarGoal(submittedGoal) : null
      if (liveKind) {
        rememberLayout()
        const today = calendarDate(undefined, calendar.timezone)
        const date = submittedGoal.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ?? shiftDate(today, /tomorrow/i.test(submittedGoal) ? 1 : 0)
        const request:LiveRequest={kind:liveKind,goal:submittedGoal,date}
        updateLive(request)
        setItems(current=>{const index=current.findIndex(item=>item.id==='meetings');const next=[...current];const item:ManagedItem={id:'meetings',span:current[index]?.span??'full',live:request};if(index<0)next.push(item);else next[index]=item;return next})
        calendar.setDate(date); completeTurn(id, 'ready', liveKind === 'schedule' ? 'Let’s arrange your meeting. Enter the details below, choose a time and review before creating it.' : 'Let’s find the meeting you want to prepare. Choose it below to open your preparation tools.'); return
      }
    }
    const result = await workflow.run({ goal: submittedGoal, previousUI: response, context: { demoDate: DEMO_DATE, tasks: state.tasks, events: state.events, drafts: { ...state.drafts, ...draftBuffers }, pins: state.pins, componentState } }, answer)
    if (activeTurn.current !== id) return
    if (!result) { const outcome = workflow.getOutcome(); completeTurn(id, outcome.clarification ? 'clarification' : 'error', outcome.clarification?.question ?? outcome.error ?? 'Your workspace could not be prepared. Try again.'); if(outcome.clarification)setCommandOpen(true); return }
    setLiveRequest(null); liveCalendarLayoutService.clear(); setUseDemoCalendar(false)
    if (result.kind === 'meeting') result.session = retainMeetingTaskFilters(meeting, result.session)
    const saved = result.kind === 'usage' ? layoutService.saveUsage(result.session) : result.kind === 'overdue' ? layoutService.saveOverdue(result.session) : result.kind === 'meeting' ? layoutService.saveMeeting(result.session) : layoutService.save(result.response)
    setUsage(result.kind === 'usage' ? result.session : null)
    setOverdue(result.kind === 'overdue' ? result.session : null)
    setMeeting(result.kind === 'meeting' ? result.session : null)
    setPersistenceNotice(saved.status === 'saved' ? '' : 'Layout updated, but device storage is unavailable. It may not survive reload.')
    if(result.kind==='general'){setResponse(result.response);const ids=[...result.response.matchAll(/WorkspaceWidget\(\s*"([a-z-]+)"/g)].map(m=>m[1]).filter((id):id is WidgetType=>widgetTypes.includes(id as WidgetType));setItems(current=>applyWorkspaceOperations(current,[{type:'add',widgets:ids}],id=>({id,span:'full'})))}
    else {
      const session=result.session
      setItems(current=>{const next=[...current];for(const widget of session.composition.widgets){const index=next.findIndex(item=>item.id===widget.type);const item:ManagedItem={id:widget.type,span:next[index]?.span??widget.span,...(result.kind==='meeting'?{meeting:result.session}:result.kind==='usage'?{usage:result.session}:{overdue:result.session})};if(index<0)next.push(item);else next[index]=item}return next})
    }
    setComponentState({}); setRevision(value => value + 1); setGoal(''); setCommandOpen(false)
    completeTurn(id, 'ready', 'Your workspace is ready. Use the tools below, or send a follow-up to change the layout.')
  }
  function updateItem(widget:WidgetType,patch:Partial<ManagedItem>) {setItems(current=>current.map(item=>item.id===widget?{...item,...patch}:item))}
  function updateComponentBindings(widget:WidgetType,bindings:Partial<ViewBindings>) {
    setItems(current=>current.map(item=>item.id===widget&&item.plan?{...item,plan:componentViewSchema.parse({...item.plan,bindings:{...item.plan.bindings,...bindings}})}:item))
  }
  function generate(event: FormEvent) { event.preventDefault(); void build() }
  const workspaceTurnId = conversation.workspaceTurnId ?? [...conversation.turns].reverse().find(turn => turn.status === 'ready')?.id
  const currentResponseTurn = conversation.turns.find(turn => turn.id === workspaceTurnId)
  return <div className={conversation.active ? "dynamic-canvas-page flex h-[calc(100dvh-64px)] flex-col max-sm:h-[calc(100dvh-60px)]" : "dynamic-canvas-page"} data-conversation-active={conversation.active}><PageHeaderActions><button className="command-trigger" onClick={() => changeCommand(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setCalendarSettings(true)}>Google Calendar connection</DropdownMenuItem><DropdownMenuItem disabled={!layoutUndo.length} onClick={undoLayout}>Undo layout change</DropdownMenuItem><DropdownMenuItem onClick={resetLayout}><RotateCcw size={14} /> Reset layout</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>

    <main ref={scrollArea} className={conversation.active ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : "generated-canvas"} aria-label="Context-aware workspace">
      <div className={conversation.active ? "mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-8" : "space-y-5"}>
        {persistenceNotice && <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground" role="status"><span>{persistenceNotice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setPersistenceNotice('')}><X size={14} /></Button></div>}
        {conversation.active && <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Active workspace</p><p className="mt-1 text-sm font-medium">{currentResponseTurn?.prompt ?? 'Describe the workspace you need'}</p></div><span className="text-xs text-muted-foreground">Ctrl / Cmd + K to update</span></div>}
        {conversation.turns.at(-1) && <div className="flex items-start gap-3" aria-label="Workspace status"><OrloLogo size={22} /><p className={`min-w-0 flex-1 text-sm leading-6 ${conversation.turns.at(-1)?.status==='error'?'text-destructive':'text-muted-foreground'}`} role={conversation.turns.at(-1)?.status==='error'?'alert':'status'}>{pending && <LoaderCircle size={15} className="mr-2 inline animate-spin" />}{conversation.turns.at(-1)?.reply}</p>{pending && <Button variant="ghost" size="sm" onClick={stopConversation}>Stop</Button>}</div>}
        <section ref={canvas} tabIndex={-1} className="productivity-response outline-none" aria-label="Active workspace">
          {<>
            <div className="workspace-grid">{items.map(item=>{
              const Widget=registry[item.id].component
              const content=item.id==='metrics'?<Widget/>:<WidgetFrame id={item.id}><Widget/></WidgetFrame>
              const scoped=item.meeting?<MeetingScopeProvider session={item.meeting} onFilters={filters=>updateItem(item.id,{meeting:{...item.meeting!,taskFilters:filters}})}>{content}</MeetingScopeProvider>:item.usage?<UsageScopeProvider session={item.usage} onFilters={filters=>updateItem(item.id,{usage:{...item.usage!,taskFilters:filters}})}>{content}</UsageScopeProvider>:item.overdue?<OverdueScopeProvider session={item.overdue} onFilters={filters=>updateItem(item.id,{overdue:{...item.overdue!,filters}})}>{content}</OverdueScopeProvider>:content
              return <div key={item.id} className={`workspace-cell span-${item.span}`} data-workspace-component={item.id}>{item.live?<LiveCalendarWorkspace request={item.live} onChange={live=>{updateItem(item.id,{live});updateLive(live)}} onClose={()=>setItems(current=>current.filter(i=>i.id!==item.id))} onDemo={()=>{setUseDemoCalendar(true);setGoal(item.live!.goal);setCommandOpen(true)}}/>:item.plan?<ComponentViewProvider plan={item.plan} onChange={bindings=>updateComponentBindings(item.id,bindings)}>{scoped}</ComponentViewProvider>:scoped}</div>
            })}</div>
            {!items.length&&<div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground"><p>Your workspace is empty.</p><Button className="mt-4" variant="outline" onClick={()=>changeCommand(true)}>Press Ctrl / Cmd + K to add components</Button></div>}
          </>}
        </section>
        {error && conversation.turns.at(-1)?.status!=='error' && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </div>
    </main>
    {<Dialog open={calendarSettings} onOpenChange={setCalendarSettings}><DialogContent><DialogHeader><DialogTitle>Calendar connection</DialogTitle><DialogDescription>Connect Google to read real events. Event creation asks for additional permission and confirmation.</DialogDescription></DialogHeader><GoogleCalendarConnection /></DialogContent></Dialog>}
    {<Dialog open={commandOpen} onOpenChange={changeCommand}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader><DialogTitle className="sr-only">Change your workspace</DialogTitle><DialogDescription className="sr-only">Describe a goal or choose the meeting to prepare. Escape cancels and closes this window.</DialogDescription></DialogHeader>{componentQuestion ? <div className="space-y-4 p-4"><p className="text-sm font-medium">{componentQuestion.question}</p><div className="flex flex-wrap gap-2">{componentQuestion.choices.map(choice=><Button key={choice} variant="outline" size="sm" disabled={pending} onClick={()=>void build(undefined,false,choice)}>{choice}</Button>)}</div><Button variant="ghost" size="sm" onClick={()=>setComponentQuestion(null)}>Write a different prompt</Button></div> : clarification ? <ClarificationForm key={clarification.requestId} question={clarification} pending={pending} onAnswer={answer => void build(answer)} onCancel={() => changeCommand(false)} /> : <form onSubmit={generate} className="goal-form"><div className="goal-input-row"><OrloLogo size={20} /><label htmlFor="command-goal" className="sr-only">Describe the workspace you need</label><input id="command-goal" autoFocus value={goal} onChange={event => { speech.cancel(); setGoal(event.target.value) }} placeholder="Describe your workspace or a change…" maxLength={4000} disabled={pending} /><Button type="button" variant={speech.listening ? 'secondary' : 'ghost'} size="icon" onClick={speech.toggle} disabled={pending || !speech.supported || (!speech.listening && goal.length >= 4000)} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'} aria-pressed={speech.listening} title={speech.supported ? (speech.listening ? 'Stop listening' : 'Speak your goal') : 'Speech input is unavailable in this browser'} className={speech.listening ? 'text-primary ring-2 ring-primary/20' : 'text-muted-foreground'}>{speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div><p className="px-4 pb-2 text-xs text-muted-foreground" role="status" aria-live="polite">{speech.listening ? 'Listening… speak your goal, then tap stop.' : speech.supported ? 'Type or speak using your browser’s speech service. Review before sending.' : 'Speech input is unavailable in this browser. Type your goal instead.'}</p>{speech.error && <p className="px-4 pb-2 text-xs text-destructive" role="alert">{speech.error}</p>}</form>}{pending && <div className="goal-progress" role="status">Preparing your workspace… <button type="button" onClick={stopConversation}>Cancel</button></div>}{error && <p className="goal-error" role="alert">{error}</p>}<div className="command-hint"><span>{calendar.connection?.connected ? `Live calendar · ${calendar.timezone}` : `Demo date · ${DEMO_DATE} · Connect Google for real meetings`}</span><span>Esc to close</span></div></DialogContent></Dialog>}
  </div>
}
