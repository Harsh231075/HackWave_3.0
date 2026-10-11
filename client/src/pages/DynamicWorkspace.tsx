import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Command, Mic, Square, ArrowUp, LoaderCircle, MoreHorizontal, RotateCcw, History, Undo2, PinOff, CalendarDays, X } from 'lucide-react'
import { useWorkspaceDocument } from '@/hooks/useWorkspaceDocument'
import { useAdaptiveWorkspace, type Clarification } from '@/hooks/useAdaptiveWorkspace'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { resolveComponentIntent } from '@/services/componentIntentService'
import { adaptiveDataService, resourceService } from '@/services'
import { makeInstance, instancesFromLayout } from '@/services/workspaceDocumentService'
import { instancePlan, applyComponentView } from '@/domain/instanceViews'
import { commitWorkspace, resetWorkspaceLayout, clearWorkspacePins, resolveTarget, applyInstanceOperations, TargetError, type WorkspaceDocument } from '@/domain/workspaceDocument'
import { localManagement, namedWidgets } from '@/domain/workspaceManagement'
import { componentViewSchema } from '@/domain/componentIntent'
import { calendarDate, shiftDate } from '@/domain/calendar'
import { InstanceCanvas } from '@/lib/workspace/InstanceCanvas'
import { WorkspaceActionHost } from '@/lib/workspace/WorkspaceActionHost'
import { extractActiveWidgets, extractGeneratedActions, extractGeneratedText } from '@/lib/workspace/workspaceNodes'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'
import { DEMO_DATE } from '@/data/demo'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { IntentRequest } from '@/domain/intent'
import type { WidgetInstance, PinnedWidget, WidgetBinding } from '@/domain/widgetInstances'
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
  const workspace = useWorkspaceDocument()
  const { document, current, save, setNotice } = workspace
  const { state, draftBuffers } = useWorkspace()
  const calendar = useGoogleCalendar()
  const workflow = useAdaptiveWorkspace()
  const location = useLocation()
  const initialGoal = typeof location.state?.goal === 'string' ? location.state.goal.slice(0, 4000) : ''
  const [goal, setGoal] = useState(initialGoal)
  const [commandOpen, setCommandOpen] = useState(!!initialGoal)
  const [settings, setSettings] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [question, setQuestion] = useState<{ question: string; choices: Array<{ id?: string; label: string }> } | null>(null)
  const request = useRef<AbortController | null>(null)
  const activeTurn = useRef<string | null>(null)
  const pending = resolving || workflow.pending
  const speech = useSpeechToText({ value: goal, onChange: setGoal, enabled: commandOpen && !pending && !workflow.clarification })
  const lastGoal = useRef('')
  const canvas = useRef<HTMLElement | null>(null)
  function finish(id: string, status: WorkspaceDocument['turns'][number]['status'], reply: string) {
    save({ ...current.current, turns: current.current.turns.map(t => t.id === id ? { ...t, status, reply: reply.slice(0, 2000) } : t) }, false)
  }
  function stop() {
    request.current?.abort(); request.current = null; workflow.cancel(); setResolving(false); speech.cancel()
    if (activeTurn.current) finish(activeTurn.current, 'cancelled', 'Stopped. Existing workspace and edits are kept.')
    activeTurn.current = null
  }
  useEffect(() => () => { request.current?.abort() }, [])
  useEffect(() => {
    const url = new URL(window.location.href), outcome = url.searchParams.get('calendar')
    if (!outcome) return
    setNotice(outcome === 'connected' ? 'Google Calendar connected. Send your meeting goal to continue.' : 'Calendar connection could not complete. Open Calendar connection to retry.')
    setSettings(outcome !== 'connected'); url.searchParams.delete('calendar'); window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
  }, [setNotice])
  function update(instance: WidgetInstance | PinnedWidget) {
    try { save(commitWorkspace(current.current, { active: current.current.active.map(w => w.instanceId === instance.instanceId ? instance : w), pins: current.current.pins.map(w => w.instanceId === instance.instanceId ? { ...instance, pinId: w.pinId, createdAt: w.createdAt } : w) })) }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Invalid view update.') }
  }
  async function build(answer?: IntentRequest['clarificationAnswer'], retry?: string, exactTarget?: string, useDemo = false) {
    const submitted = answer?.originalGoal ?? retry ?? goal.trim()
    if (!submitted || request.current || pending) return
    const controller = new AbortController(); request.current = controller; setResolving(true)
    const id = crypto.randomUUID(); activeTurn.current = id; lastGoal.current = submitted
    save({ ...current.current, turns: [...current.current.turns, { id, prompt: submitted, reply: 'Preparing your workspace…', status: 'pending' as const }].slice(-60) }, false)
    setCommandOpen(false); setGoal(''); setQuestion(null); speech.cancel()
    const valid = () => !controller.signal.aborted && activeTurn.current === id
    try {
      const records = adaptiveDataService.snapshot()
      const all = [...current.current.active, ...current.current.pins]
      const types = namedWidgets(submitted)
      const previous = /\b(another|second|additional|separate)\b/i.test(submitted) ? undefined : exactTarget ? all.find(w => w.instanceId === exactTarget) : types.length === 1 ? resolveTarget(current.current, types[0], true) : all.find(w => current.current.targets.includes(w.instanceId))
      const input = { goal: submitted, referenceDate: calendarDate(undefined, calendar.timezone), timezone: calendar.timezone, workspaceWidgets: current.current.active.map(w => w.widgetType), instances: all, componentPlans: all.map(instancePlan), previous: previous ? instancePlan(previous) : undefined, catalog: { owners: [...new Set(state.tasks.map(t => t.owner))], projects: records?.projects ?? [], clients: records?.clients ?? [], draftKeys: Object.keys({ ...state.drafts, ...draftBuffers }).filter(key => !key.startsWith('google-preparation:') || !!calendar.connection?.accountId && key.startsWith('google-preparation:' + calendar.connection.accountId + ':')), topics: [...new Set(resourceService.list().map(r => r.context))] } }
      const resolved = answer ? null : localManagement(submitted) ?? await resolveComponentIntent(input, controller.signal)
      if (!valid()) return
      if (resolved?.action === 'clarify') { setQuestion({ question: resolved.question, choices: resolved.choices.map(label => ({ label })) }); finish(id, 'clarification', resolved.question); setCommandOpen(true); return }
      if (resolved?.action === 'manage') {
        const operations = exactTarget ? resolved.operations.map(op => op.type === 'remove' || op.type === 'keep' || op.type === 'replace' ? { ...op, widgets: op.widgets.map(type => previous?.widgetType === type ? exactTarget : type) } : op.type === 'move' || op.type === 'resize' ? { ...op, widget: previous?.widgetType === op.widget ? exactTarget : op.widget } : op) : resolved.operations
        const includePins = /\b(including pins|pinned|all pins)\b/i.test(submitted)
        const next = applyInstanceOperations(current.current, operations, type => makeInstance(type, { kind: 'workspace' }, { referenceDate: input.referenceDate, timezone: input.timezone }), includePins)
        if (!save(next)) throw new Error('Workspace could not be saved.')
        finish(id, 'ready', resolved.reply); return
      }
      if (resolved?.action === 'view') {
        let binding: WidgetBinding | undefined
        if (!useDemo && calendar.connection?.connected && calendar.connection.accountId && resolved.widgets.some(type => ['calendar', 'meetings', 'availability'].includes(type))) binding = { kind: 'google-calendar', accountId: calendar.connection.accountId, calendarId: 'primary', mode: 'browse' }
        if (!binding && previous?.binding.kind === 'google-calendar' && previous.binding.mode === 'prepare' && resolved.widgets.some(type => ['context', 'outline'].includes(type))) binding = previous.binding
        if (!save(applyComponentView(current.current, resolved, submitted, binding, exactTarget))) throw new Error('Workspace could not be saved.')
        finish(id, 'ready', resolved.reply); return
      }
      if (resolved?.action === 'workflow' && ['meeting_preparation', 'meeting_scheduling'].includes(resolved.kind) && !useDemo) {
        if (!calendar.connection?.connected || !calendar.connection.accountId) {
          setQuestion({ question: 'Use a real Google Calendar meeting or demo records?', choices: [{ label: 'Connect Google Calendar' }, { label: 'Use demo records' }] }); finish(id, 'clarification', 'Connect Google Calendar or choose demo records.'); setCommandOpen(true); return
        }
        const binding: WidgetBinding = { kind: 'google-calendar', accountId: calendar.connection.accountId, calendarId: 'primary', mode: resolved.kind === 'meeting_scheduling' ? 'schedule' : 'prepare' }
        const plan = componentViewSchema.parse({ action: 'view', widgets: ['meetings'], bindings: { taskFilters: state.filters, selectedDate: /tomorrow/i.test(submitted) ? shiftDate(input.referenceDate, 1) : input.referenceDate }, referenceDate: input.referenceDate, timezone: input.timezone, reply: 'Your Google Calendar workspace is ready.' })
        const next = applyComponentView(current.current, plan, submitted, binding, exactTarget)
        next.active = next.active.map(w => next.targets.includes(w.instanceId) ? { ...w, viewState: { ...w.viewState, goal: submitted } } : w)
        if (!save(next)) throw new Error('Workspace could not be saved.')
        finish(id, 'ready', plan.reply); return
      }
      const result = await workflow.run({ goal: submitted, previousUI: '', context: { demoDate: input.referenceDate, tasks: state.tasks, events: state.events, drafts: state.drafts, pins: current.current.pins.map(p => p.widgetType), componentState: {} } }, answer)
      if (!valid()) return
      if (!result) { finish(id, workflow.getOutcome().clarification ? 'clarification' : 'error', workflow.getOutcome().error || 'Choose the details needed to continue.'); setCommandOpen(true); return }
      const instances = result.kind === 'general' ? extractActiveWidgets(result.response, productivityLibrary.toJSONSchema(), productivityLibrary.root).map(w => ({ ...makeInstance(w.id), span: w.span })) : instancesFromLayout(result.session)
      let next = current.current
      for (const instance of instances) {
        const plan = instancePlan(instance)
        next = applyComponentView(next, plan, submitted, instance.binding, exactTarget)
        next.active = next.active.map(w => next.targets.includes(w.instanceId) ? { ...w, span: instance.span, explanation: instance.explanation, fingerprint: instance.fingerprint } : w)
      }
      const response = result.kind === 'general' ? result.response : result.session.response
      const buttons = extractGeneratedActions(response, productivityLibrary.toJSONSchema(), productivityLibrary.root)
      const origin = instances[0] && [...next.active, ...next.pins].find(w => w.widgetType === instances[0].widgetType && JSON.stringify(w.binding) === JSON.stringify(instances[0].binding))
      if (origin && buttons.length) next = { ...next, active: next.active.map(w => w.instanceId === origin.instanceId ? { ...w, actions: buttons } : w), pins: next.pins.map(w => w.instanceId === origin.instanceId ? { ...w, actions: buttons } : w) }
      if (!save(next)) throw new Error('Workspace could not be saved.')
      finish(id, 'ready', extractGeneratedText(response, productivityLibrary.toJSONSchema(), productivityLibrary.root) || 'Your workspace is ready.')
    } catch (failure) {
      if (!valid()) return
      if (failure instanceof TargetError) { setQuestion({ question: failure.message, choices: failure.choices.map(choice => ({ id: choice.id, label: choice.label })) }); finish(id, 'clarification', failure.message); setCommandOpen(true) }
      else finish(id, 'error', failure instanceof Error ? failure.message : 'Unable to update workspace.')
    } finally { if (request.current === controller) { request.current = null; setResolving(false) } }
  }
  function close(open: boolean) {
    if (!open) { speech.cancel(); if (pending) stop() }
    else { setHistoryOpen(false); setSettings(false) }
    setCommandOpen(open)
  }
  function openSettings() { close(false); setHistoryOpen(false); setSettings(true) }
  function resetLayout() {
    stop(); workflow.reset(); setQuestion(null); setGoal(''); setCommandOpen(false)
    if (save(resetWorkspaceLayout(current.current))) requestAnimationFrame(() => canvas.current?.focus({ preventScroll: true }))
  }
  function clearPins() { stop(); save(clearWorkspacePins(current.current)) }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); close(!commandOpen) }
    }
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle)
  })
  const latest = document.turns.at(-1)
  return <WorkspaceActionHost revision={document.revision} pending={pending} onGoalChange={async goal => { await build(undefined, goal) }}>
    <div className="dynamic-canvas-page">
      <PageHeaderActions><button className="command-trigger" onClick={() => close(true)} aria-label="Change workspace goal"><Command size={14} /><kbd>Ctrl K</kbd></button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent align="end" className="min-w-44"><DropdownMenuItem onClick={() => { speech.cancel(); setCommandOpen(false); setSettings(false); setHistoryOpen(true) }}><History size={16} aria-hidden="true" /> History</DropdownMenuItem><DropdownMenuItem disabled={!workspace.canUndo || pending} onClick={workspace.undo}><Undo2 size={16} aria-hidden="true" /> Undo layout</DropdownMenuItem><DropdownMenuItem onClick={resetLayout}><RotateCcw size={16} aria-hidden="true" /> Reset layout</DropdownMenuItem><DropdownMenuItem onClick={clearPins}><PinOff size={16} aria-hidden="true" /> Clear pins</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={openSettings}><CalendarDays size={16} aria-hidden="true" /> Google Calender</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>
      <main className={`generated-canvas${latest ? ' workspace-has-status' : ''}`} aria-label="Context-aware workspace">
        {workspace.notice && <div role="status" className="mb-4 flex items-center justify-between gap-3 rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground"><span>{workspace.notice}</span><Button variant="ghost" size="icon-sm" aria-label="Dismiss layout message" onClick={() => setNotice('')}><X size={14} /></Button></div>}
        {latest && <div className="mb-4 flex items-start gap-3" aria-label="Workspace status"><OrloLogo size={22} /><p role={latest.status === 'error' ? 'alert' : 'status'} className={`min-w-0 flex-1 text-sm leading-6 ${latest.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{pending && <LoaderCircle className="mr-2 inline animate-spin" size={15} />}{latest.reply}</p>{pending && <Button size="sm" variant="ghost" onClick={stop}>Stop</Button>}</div>}
        <section ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace"><InstanceCanvas instances={[...document.active, ...document.pins]} update={update} />
          {!document.active.length && !document.pins.length && <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground"><p>Your workspace is empty.</p><Button className="mt-4" variant="outline" onClick={() => close(true)}>Press Ctrl / Cmd + K to add components</Button></div>}
        </section>

      </main>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent className="workspace-history-dialog"><DialogHeader><DialogTitle>History</DialogTitle><DialogDescription>Your workspace prompts and responses.</DialogDescription></DialogHeader><div className="min-h-0 overflow-y-auto pr-2">{document.turns.length ? <ol className="space-y-5">{[...document.turns].reverse().map(turn => <li key={turn.id} className="space-y-2 border-b pb-4"><p className="text-sm font-medium whitespace-pre-wrap">{turn.prompt}</p><div className="flex items-start gap-3"><OrloLogo size={18} /><p className="min-w-0 text-sm text-muted-foreground whitespace-pre-wrap">{turn.reply}</p></div><p className="text-xs text-muted-foreground">{({ pending: 'In progress', ready: 'Completed', error: 'Failed', cancelled: 'Cancelled', clarification: 'Needs clarification' })[turn.status]}</p></li>)}</ol> : <p className="py-8 text-center text-muted-foreground">No conversation history yet.</p>}</div></DialogContent></Dialog>
      <Dialog open={settings} onOpenChange={setSettings}><DialogContent><DialogHeader><DialogTitle>Calendar connection</DialogTitle><DialogDescription>Connect Google to read real events. Creating events requires additional permission and confirmation.</DialogDescription></DialogHeader><GoogleCalendarConnection /></DialogContent></Dialog>
      <Dialog open={commandOpen} onOpenChange={close}><DialogContent className="goal-command-dialog" showCloseButton={false}><DialogHeader className="sr-only"><DialogTitle>Change your workspace</DialogTitle><DialogDescription>Describe a goal or choose a view. Escape cancels and closes this window.</DialogDescription></DialogHeader>
        {question ? <div className="space-y-3"><p>{question.question}</p>{question.choices.map((choice, index) => <Button key={choice.id ?? index} variant="outline" disabled={pending} onClick={() => { if (choice.label === 'Connect Google Calendar') { openSettings() } else void build(undefined, choice.id || choice.label === 'Use demo records' ? lastGoal.current : choice.label, choice.id, choice.label === 'Use demo records') }}>{choice.label}</Button>)}<Button variant="ghost" onClick={() => setQuestion(null)}>Write a different prompt</Button></div> : workflow.clarification ? <ClarificationForm question={workflow.clarification} pending={pending} onCancel={() => { stop(); close(false) }} onAnswer={answer => void build(answer)} /> : <form className="goal-form" onSubmit={(event: FormEvent) => { event.preventDefault(); void build() }}><div className="goal-input-row"><OrloLogo size={20} /><label className="sr-only" htmlFor="workspace-goal">Describe the workspace you need</label><input id="workspace-goal" autoFocus value={goal} maxLength={4000} disabled={pending} onChange={event => { speech.cancel(); setGoal(event.target.value) }} placeholder="Describe your workspace or a change…" /><Button type="button" size="icon" variant={speech.listening ? 'secondary' : 'ghost'} disabled={pending || !speech.supported || (!speech.listening && goal.length >= 4000)} onClick={speech.toggle} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'} aria-pressed={speech.listening} title={speech.supported ? 'Speak your goal' : 'Speech input is unavailable in this browser'}>{speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Build workspace">{pending ? <LoaderCircle className="animate-spin" size={18} /> : <ArrowUp size={18} />}</Button></div><p className="px-4 pb-2 text-xs text-muted-foreground" role="status" aria-live="polite">{speech.listening ? 'Listening… speak your goal, then tap stop.' : speech.supported ? 'Type or speak using your browser’s speech service. Review before sending.' : 'Speech input is unavailable in this browser. Type your goal instead.'}</p></form>}
        {speech.error && <p className="goal-error" role="alert">{speech.error}</p>}
        <div className="command-hint"><span>{calendar.connection?.connected ? `Live calendar · ${calendar.timezone}` : `Demo date · ${DEMO_DATE} · Connect Google for real meetings`}</span><span>Esc to close</span></div>
      </DialogContent></Dialog>
    </div>
  </WorkspaceActionHost>
}
