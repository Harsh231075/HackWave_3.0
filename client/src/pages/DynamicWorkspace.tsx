import { useLocation } from 'react-router-dom'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Command, Mic, Square, ArrowUp, LoaderCircle, MoreHorizontal } from 'lucide-react'
import { useWorkspaceDocument } from '@/hooks/useWorkspaceDocument'
import { useAdaptiveWorkspace, type Clarification } from '@/hooks/useAdaptiveWorkspace'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { useGoogleCalendar } from '@/state/GoogleCalendarContext'
import { resolveComponentIntent } from '@/services/componentIntentService'
import { adaptiveDataService, resourceService } from '@/services'
import { makeInstance, instancesFromLayout } from '@/services/workspaceDocumentService'
import { instancePlan, applyComponentView } from '@/domain/instanceViews'
import { commitWorkspace, emptyWorkspace, resolveTarget, applyInstanceOperations, TargetError, type WorkspaceDocument } from '@/domain/workspaceDocument'
import { localManagement, namedWidgets } from '@/domain/workspaceManagement'
import { componentViewSchema } from '@/domain/componentIntent'
import { calendarDate, shiftDate } from '@/domain/calendar'
import { InstanceCanvas } from '@/lib/workspace/InstanceCanvas'
import { WorkspaceActionHost } from '@/lib/workspace/WorkspaceActionHost'
import { extractActiveWidgets, extractGeneratedActions, extractGeneratedText } from '@/lib/workspace/workspaceNodes'
import { productivityLibrary } from '@/lib/workspace/OpenUIWorkspace'
import { GoogleCalendarConnection } from '@/components/calendar/GoogleCalendarWidgets'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
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
    const handle = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(open => !open) }
    }
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle)
  }, [])
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
  function close(open: boolean) { if (!open && pending) stop(); setCommandOpen(open) }
  const latest = document.turns.at(-1)
  return <WorkspaceActionHost revision={document.revision} pending={pending} onGoalChange={async goal => { await build(undefined, goal) }}>
    <div className="dynamic-canvas-page">
      <PageHeaderActions><Button variant="ghost" size="sm" onClick={() => setCommandOpen(true)}><Command size={14} /> Ctrl K</Button><DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Workspace options" />}><MoreHorizontal size={18} /></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => setSettings(true)}>Google Calendar connection</DropdownMenuItem><DropdownMenuItem disabled={!workspace.canUndo} onClick={workspace.undo}>Undo layout change</DropdownMenuItem><DropdownMenuItem onClick={() => { stop(); workflow.reset(); save({ ...emptyWorkspace(), revision: current.current.revision + 1 }); workspace.clearUndo() }}>Reset workspace and pins</DropdownMenuItem></DropdownMenuContent></DropdownMenu></PageHeaderActions>
      <main className="generated-canvas" aria-label="Context-aware workspace">
        {workspace.notice && <p role="status" className="mb-4 text-sm text-muted-foreground">{workspace.notice}</p>}
        {latest && <div className="mb-4 flex items-center gap-3"><p role={latest.status === 'error' ? 'alert' : 'status'} className="text-sm">{pending && <LoaderCircle className="mr-2 inline animate-spin" size={15} />}{latest.reply}</p>{pending && <Button size="sm" variant="ghost" onClick={stop}>Stop</Button>}</div>}
        <section ref={canvas} tabIndex={-1} aria-label="Generated productivity workspace"><InstanceCanvas instances={[...document.active, ...document.pins]} update={update} />
          {!document.active.length && !document.pins.length && <div className="rounded-xl border border-dashed p-12 text-center"><p>Your workspace is empty.</p><Button className="mt-4" onClick={() => setCommandOpen(true)}>Add components</Button></div>}
        </section>
        {!!document.turns.length && <details className="mt-6 text-sm"><summary>Conversation history</summary><ol className="mt-3 space-y-3">{document.turns.map(turn => <li key={turn.id}><p className="font-medium">{turn.prompt}</p><p className="text-muted-foreground">{turn.reply}</p></li>)}</ol></details>}
      </main>
      <Dialog open={settings} onOpenChange={setSettings}><DialogContent><DialogHeader><DialogTitle>Calendar connection</DialogTitle><DialogDescription>Connect Google to read real events. Creating events requires additional permission and confirmation.</DialogDescription></DialogHeader><GoogleCalendarConnection /></DialogContent></Dialog>
      <Dialog open={commandOpen} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Change your workspace</DialogTitle><DialogDescription>Add, filter, move, resize, or remove a view.</DialogDescription></DialogHeader>
        {question ? <div className="space-y-3"><p>{question.question}</p>{question.choices.map((choice, index) => <Button key={choice.id ?? index} variant="outline" disabled={pending} onClick={() => { if (choice.label === 'Connect Google Calendar') { setCommandOpen(false); setSettings(true) } else void build(undefined, choice.id || choice.label === 'Use demo records' ? lastGoal.current : choice.label, choice.id, choice.label === 'Use demo records') }}>{choice.label}</Button>)}<Button variant="ghost" onClick={() => setQuestion(null)}>Write a different prompt</Button></div> : workflow.clarification ? <ClarificationForm question={workflow.clarification} pending={pending} onCancel={() => { stop(); close(false) }} onAnswer={answer => void build(answer)} /> : <form className="flex items-center gap-2" onSubmit={(event: FormEvent) => { event.preventDefault(); void build() }}><label className="sr-only" htmlFor="workspace-goal">Workspace goal</label><input id="workspace-goal" className="min-w-0 flex-1 rounded border p-3" autoFocus value={goal} maxLength={4000} disabled={pending} onChange={event => { speech.cancel(); setGoal(event.target.value) }} placeholder="Describe your workspace or a change…" /><Button type="button" size="icon" variant="ghost" disabled={pending || !speech.supported} onClick={speech.toggle} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'}>{speech.listening ? <Square size={16} /> : <Mic size={16} />}</Button><Button type="submit" size="icon" disabled={pending || !goal.trim()} aria-label="Update workspace"><ArrowUp size={16} /></Button></form>}
        {speech.error && <p role="alert">{speech.error}</p>}
      </DialogContent></Dialog>
    </div>
  </WorkspaceActionHost>
}
