import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, LoaderCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { browserDatabase, extensionService } from '@/services'
import { mailFolders, MAIL_ATTACHMENT_LIMIT, emptyMailDraft, replyDraft, type MailAttachment, type MailFolder, type MailMessage } from '@/domain/mail'
import type { WidgetInstance } from '@/domain/widgetInstances'
import { WidgetActions } from '@/lib/workspace/WidgetActions'
import { mailService } from './mailRuntime'
import { MAIL_PAGE_SIZE } from './mailCache'
import { useMail } from './useMail'
import { mailDocument, mailPlainText } from './safeMail'

const inputClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm'

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Mail could not complete this operation.' }
export function MailConnection({ compact = false }: { compact?: boolean }) {
  const state = useMail(), [error, setError] = useState(''), [ready, setReady] = useState(false)
  useEffect(() => {
    if (!state.configured) return
    let active = true
    void mailService.prepare().then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(messageOf(error)) })
    return () => { active = false }
  }, [state.configured])
  async function run(operation: () => Promise<unknown> | void) { setError(''); try { await operation() } catch (error) { setError(messageOf(error)) } }
  return <section className="space-y-2" aria-label="Gmail connection">
    {!state.configured ? <p>Configure <code>VITE_GOOGLE_CLIENT_ID</code> to connect Gmail. <a className="underline" href="https://developers.google.com/workspace/gmail/api/quickstart/js" target="_blank" rel="noreferrer">Google setup guide</a></p> : <div className={compact ? "flex flex-wrap items-center gap-2 border-t border-border pt-3" : "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3"}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {!compact && <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Mail className="size-4" aria-hidden="true" /></div>}
        <div className="min-w-0">
          {!compact && <p className="text-sm font-medium">Gmail</p>}
          <p className="break-all text-xs text-muted-foreground" role="status">{state.email ?? 'Not connected'}{state.status === 'expired' ? ' · Access expired' : ''}</p>
        </div>
      </div>
      {state.status !== 'connected' ? <Button size="sm" disabled={state.status === 'connecting' || !ready} onClick={() => void run(() => mailService.connect())}>{(state.status === 'connecting' || !ready) && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}{state.status === 'connecting' ? 'Connecting…' : !ready ? 'Loading Google sign-in…' : state.accountId ? 'Reconnect' : 'Connect Gmail'}{state.status !== 'connecting' && ready && <ArrowUpRight className="size-3.5" aria-hidden="true" />}</Button> : <>
        <Button size="sm" variant="outline" onClick={() => void run(() => mailService.disconnect())}>Disconnect</Button>
        <Button size="sm" variant="ghost" onClick={() => void run(() => mailService.revoke())}>Revoke Google access</Button>
      </>}
      {state.status === 'expired' && <a href="https://myaccount.google.com/connections" className="text-sm underline" target="_blank" rel="noreferrer">Google account permissions</a>}
    </div>}
    {(error || state.error) && <p role="alert" className="text-sm text-destructive">{error || state.error}</p>}
  </section>
}
export function MailRuntime() {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (mailService.hasUnsaved()) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    const unregister = extensionService.beforeDisable(id => { if (id === 'mail') mailService.disconnect() })
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [])
  const epoch = useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getEpoch, browserDatabase.getEpoch)
  const previousEpoch = useRef(epoch)
  useEffect(() => { if (previousEpoch.current !== epoch) { mailService.disconnect(true); previousEpoch.current = epoch } }, [epoch])
  return null
}
export function MailAccess({ children, accountId }: { children: ReactNode; accountId?: string }) {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const state = useMail()
  if (!extensionService.isEnabled('mail')) return <div className="space-y-2"><p>Mail is disabled.</p><Link to="/plugins" className="underline">Enable Mail in Plugins</Link></div>
  if (state.status !== 'connected') return <MailConnection/>
  if (accountId && state.accountId !== accountId) return <div className="space-y-2"><p>This view belongs to another Gmail account. Disconnect and connect its original account to continue.</p><MailConnection/></div>
  return <>{children}</>
}
export function MailInbox({ folder: initialFolder = 'Inbox', onFolder, onSelect }: { folder?: MailFolder; onFolder?: (folder: MailFolder) => void; onSelect?: (messageId: string) => void }) {
  const state = useMail(), [folder, setFolder] = useState(initialFolder), [query, setQuery] = useState(''), [search, setSearch] = useState(''), [rows, setRows] = useState<{ message: MailMessage; draftId?: string }[]>([]), [page, setPage] = useState<string>(), [loading, setLoading] = useState(false), [error, setError] = useState('')
  const [composeOpen, setComposeOpen] = useState(false)
  const [pages, setPages] = useState<string[]>([''])
  const currentPage = useRef('')
  const generation = useRef(0), request = useRef<AbortController | null>(null)
  useEffect(() => { setFolder(initialFolder) }, [initialFolder])
  function invalidateReads() { request.current?.abort(); generation.current++ }
  async function load(next = '') {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    const id = ++generation.current; setLoading(true); setError('')
    try {
      const result = await mailService.listMessages(folder, search, next, controller.signal)
      if (id !== generation.current) return
      setRows(result.messages.slice(0, MAIL_PAGE_SIZE)); setPage(result.nextPageToken)
      currentPage.current = next
      setPages(previous => { const index = previous.indexOf(next); return index >= 0 ? previous.slice(0, index + 1) : [...previous, next] })
    } catch (error) { if (id === generation.current) setError(messageOf(error)) } finally { if (id === generation.current) setLoading(false) }
  }
  useEffect(() => {
    setRows([]); setPage(undefined); setPages(['']); currentPage.current = ''
    if (state.status !== 'connected') return
    void load()
    return invalidateReads
    // The connection and service revision invalidate mailbox results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search, state.status, state.accountId, state.revision])
  useEffect(() => {
    const refresh = () => { if (!document.hidden && state.status === 'connected' && !loading) void load(currentPage.current) }
    const interval = setInterval(refresh, 60000); window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search, state.status, state.accountId, loading])
  async function open(row: { message: MailMessage; draftId?: string }) {
    try { if (row.draftId) { await mailService.openDraft(row.draftId); setComposeOpen(true) } else { mailService.selectMessage(row.message.id); onSelect?.(row.message.id); setSelected(row.message.id) } } catch (error) { setError(messageOf(error)) }
  }
  const [selected, setSelected] = useState<string>()
  return <><MailAccess><div className="space-y-3">
    <div className="flex flex-wrap gap-1" aria-label="Mail folders">{mailFolders.map(item => <Button key={item} size="sm" variant={folder === item ? 'default' : 'outline'} onClick={() => { setFolder(item); onFolder?.(item); setSelected(undefined) }}>{item}</Button>)}</div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearch(query) }}><input className={inputClass} aria-label="Search Gmail" placeholder="Search Gmail (supports Gmail search syntax)" value={query} onChange={event => setQuery(event.target.value)}/><Button type="submit" variant="outline">Search</Button></form>
    <WidgetActions><Button size="sm" onClick={() => setComposeOpen(true)}>Compose</Button><Button size="sm" variant="outline" disabled={loading} onClick={() => mailService.refresh()}>Refresh</Button></WidgetActions>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p role="status" className="text-sm text-muted-foreground">{loading ? 'Loading mail…' : !rows.length && !error ? 'No messages found.' : `${rows.length} ${rows.length === 1 ? 'message' : 'messages'} loaded`}</p>
    <ul aria-label="Mail messages" className="divide-y divide-border rounded-md border border-border">{rows.map(row => <li key={row.draftId ?? row.message.id}><button className="w-full space-y-1 p-3 text-left hover:bg-muted focus-visible:outline-2" onClick={() => void open(row)}><span className="flex justify-between gap-2"><span className={row.message.labels.includes('UNREAD') ? 'font-semibold' : ''}>{row.message.from || 'Draft'}</span><span className="shrink-0 text-xs text-muted-foreground">{row.message.date ? new Date(row.message.date).toLocaleDateString() : ''}</span></span><span className="block text-sm">{row.message.labels.includes('UNREAD') && <span aria-label="Unread">● </span>}{row.message.subject}</span><span className="block truncate text-xs text-muted-foreground">{row.message.snippet}</span></button></li>)}</ul>
    {(pages.length > 1 || page) && <div className="flex gap-2"><Button variant="outline" disabled={loading || pages.length < 2} onClick={() => void load(pages.at(-2))}>Previous</Button><Button variant="outline" disabled={loading || !page} onClick={() => void load(page)}>Next</Button></div>}

  </div></MailAccess><MailComposeDialog open={composeOpen} onOpenChange={setComposeOpen}/><Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(undefined) }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}><DialogHeader><DialogTitle>Email message</DialogTitle></DialogHeader>{selected && <MailMessageView messageId={selected}/>}</DialogContent></Dialog></>
}
export function MailMessageView({ messageId: boundMessageId }: { messageId?: string }) {
  const state = useMail(), [message, setMessage] = useState<MailMessage>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [plain, setPlain] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const messageId = boundMessageId ?? state.selectedId
  useEffect(() => {
    // Clear content immediately when the externally selected Gmail message changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage(undefined)
    let active = true; const controller = new AbortController(); setError('')
    if (messageId && state.status === 'connected') void mailService.getMessage(messageId, controller.signal).then(message => { if (active) setMessage(message) }).catch(error => { if (active) setError(messageOf(error)) })
    return () => { active = false; controller.abort() }
  }, [messageId, state.status, state.accountId, state.revision])
  const documentHtml = useMemo(() => message?.html ? mailDocument(message.html) : '', [message])
  async function run(operation: () => Promise<unknown> | void) { setBusy(true); setError(''); try { await operation() } catch (error) { setError(messageOf(error)) } finally { setBusy(false) } }
  async function download(attachment: MailAttachment) {
    const bytes = await mailService.attachmentBytes(message!.id, attachment)
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' }))
    const link = document.createElement('a'); link.href = url; link.download = attachment.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <><MailAccess><div className="space-y-3">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!message ? <p role="status">{messageId ? error ? 'Message unavailable.' : 'Loading message…' : 'Select a message from your inbox.'}</p> : <>
      <h2 className="text-lg font-medium">{message.subject}</h2><div className="text-sm text-muted-foreground"><p>From: {message.from}</p><p>To: {message.to}</p>{message.cc && <p>Cc: {message.cc}</p>}<p>{message.date ? new Date(message.date).toLocaleString() : ''}</p></div>
      <div className="flex flex-wrap gap-1">{(['reply', 'reply-all', 'forward'] as const).map(mode => <Button key={mode} size="sm" variant="outline" disabled={busy} onClick={() => void run(() => { mailService.startDraft(replyDraft(message, state.email!, mode, mailPlainText(message.html))); setComposeOpen(true) })}>{mode === 'reply-all' ? 'Reply All' : mode === 'reply' ? 'Reply' : 'Forward'}</Button>)}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mailService.action(message.id, message.labels.includes('UNREAD') ? 'read' : 'unread'))}>{message.labels.includes('UNREAD') ? 'Mark read' : 'Mark unread'}</Button>
        {!message.labels.includes('TRASH') && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mailService.action(message.id, 'archive'))}>Archive</Button>}
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mailService.action(message.id, message.labels.includes('TRASH') ? 'restore' : 'trash'))}>{message.labels.includes('TRASH') ? 'Restore' : 'Trash'}</Button>
      </div>
      {message.html && <Button size="sm" variant="ghost" onClick={() => setPlain(value => !value)}>{plain ? 'Show formatted message' : 'Show plain text'}</Button>}
      {message.html && !plain ? <iframe title="Email content" sandbox="" referrerPolicy="no-referrer" srcDoc={documentHtml} className="h-96 w-full rounded-md border bg-white"/> : <pre className="whitespace-pre-wrap break-words rounded-md border p-4 text-sm">{message.text || mailPlainText(message.html) || '(Empty message)'}</pre>}
      {!!message.attachments.length && <ul aria-label="Message attachments" className="space-y-2">{message.attachments.map((attachment, index) => <li key={index} className="flex flex-wrap items-center gap-2"><span className="text-sm">{attachment.name} ({Math.ceil(attachment.size / 1024)} KiB)</span><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => download(attachment))}>Download</Button>{state.editor && <Button size="sm" variant="ghost" disabled={busy || state.editor.status === 'sending' || state.editor.status === 'uncertain'} onClick={() => void run(async () => {
        const editor = mailService.getSnapshot().editor!
        if (editor.draft.attachments.reduce((n, a) => n + a.bytes.length, attachment.size) > MAIL_ATTACHMENT_LIMIT) throw new Error('Attachments must total 10 MiB or less.')
        const bytes = await mailService.attachmentBytes(message.id, attachment)
        if (mailService.getSnapshot().editor !== editor) throw new Error('The composer changed. Select the attachment again.')
        mailService.editDraft({ attachments: [...editor.draft.attachments, { name: attachment.name, mimeType: attachment.mimeType, bytes }] })
      })}>Add to draft</Button>}</li>)}</ul>}
    </>}
  </div></MailAccess><MailComposeDialog open={composeOpen} onOpenChange={setComposeOpen}/></>
}
function MailComposeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl" aria-describedby={undefined}>
      <DialogHeader><DialogTitle>Compose email</DialogTitle></DialogHeader>
      <MailComposer/>
    </DialogContent>
  </Dialog>
}
function SavedDraftPicker({ disabled, onSelected }: { disabled: boolean; onSelected: () => void }) {
  const [open, setOpen] = useState(false), [rows, setRows] = useState<{ message: MailMessage; draftId?: string }[]>([])
  const [tokens, setTokens] = useState(['']), [next, setNext] = useState<string>(), [loading, setLoading] = useState(false), [selecting, setSelecting] = useState(false), [error, setError] = useState('')
  const state = useMail(), token = tokens.at(-1)!
  useEffect(() => {
    if (!open || state.status !== 'connected') return
    const controller = new AbortController(); let active = true
    // Reset the picker while synchronizing a new service request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true); setError(''); setRows([]); setNext(undefined)
    void mailService.listDrafts('', token, controller.signal).then(result => { if (active) { setRows(result.messages); setNext(result.nextPageToken) } }).catch(error => { if (active) setError(messageOf(error)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false; controller.abort() }
  }, [open, token, state.status, state.accountId, state.revision])
  async function select(id: string) {
    setSelecting(true); setError('')
    try { await mailService.openDraft(id); onSelected(); setOpen(false) } catch (error) { setError(messageOf(error)) } finally { setSelecting(false) }
  }
  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setTokens(['']); setOpen(true) }}>Drafts</Button>
    <Dialog open={open} onOpenChange={value => { if (!selecting) setOpen(value) }}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Saved drafts</DialogTitle></DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {loading ? <p role="status" className="text-sm text-muted-foreground">Loading drafts…</p> : !rows.length && !error ? <p className="text-sm text-muted-foreground">No saved drafts.</p> : null}
        <ul aria-label="Saved drafts" className="divide-y divide-border">{rows.map(row => <li key={row.draftId}><button type="button" disabled={loading || selecting || !row.draftId} className="w-full space-y-1 rounded-md p-3 text-left hover:bg-muted focus-visible:outline-2 disabled:opacity-50" onClick={() => void select(row.draftId!)}><span className="block text-sm font-medium">{row.message.subject}</span><span className="block truncate text-xs text-muted-foreground">{row.message.to || 'No recipient'}</span><span className="block truncate text-xs text-muted-foreground">{row.message.snippet}</span></button></li>)}</ul>
        {(tokens.length > 1 || next) && <div className="flex justify-between gap-2"><Button variant="outline" disabled={loading || selecting || tokens.length < 2} onClick={() => setTokens(previous => previous.slice(0, -1))}>Previous</Button><Button variant="outline" disabled={loading || selecting || !next} onClick={() => setTokens(previous => [...previous, next!])}>Next</Button></div>}
      </DialogContent>
    </Dialog>
  </>
}
export function MailComposer() {
  const state = useMail(), editor = state.editor, [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  async function run(operation: () => Promise<unknown> | void) { setBusy(true); setError(''); try { await operation() } catch (error) { setError(messageOf(error)) } finally { setBusy(false) } }
  const [showCc, setShowCc] = useState(false), [showBcc, setShowBcc] = useState(false)
  const emptyDraft = useMemo(() => emptyMailDraft(), [])
  const draft = editor?.draft ?? emptyDraft
  const resetRecipients = () => { setShowCc(false); setShowBcc(false) }
  const close = (discard = false) => { mailService.closeDraft(discard); resetRecipients() }
  function edit(patch: Partial<typeof draft>) {
    setNotice(''); setError('')
    try {
      if (!mailService.getSnapshot().editor) mailService.startDraft({ ...emptyMailDraft(), ...patch })
      else mailService.editDraft(patch)
    } catch (error) { setError(messageOf(error)) }
  }
  const locked = busy || state.status !== 'connected' || editor?.status === 'sending' || editor?.status === 'uncertain'
  return <div className="space-y-3" aria-label="Mail composer">
    <WidgetActions><SavedDraftPicker disabled={locked || editor?.status === 'saving'} onSelected={() => { resetRecipients(); setError(''); setNotice('') }}/></WidgetActions>
    {state.status !== 'connected' && <MailConnection/>}
    {state.email && <p className="text-sm text-muted-foreground">From: {state.email}</p>}
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1 text-sm">To<Input disabled={locked} value={draft.to} onChange={event => edit({ to: event.target.value })}/></label>
      {!showCc && !draft.cc && <Button variant="ghost" size="sm" aria-label="Show Cc" aria-expanded={false} onClick={() => setShowCc(true)}>Cc</Button>}
      {!showBcc && !draft.bcc && <Button variant="ghost" size="sm" aria-label="Show Bcc" aria-expanded={false} onClick={() => setShowBcc(true)}>Bcc</Button>}
    </div>
    {(showCc || !!draft.cc) && <label className="block text-sm">Cc<Input disabled={locked} value={draft.cc} onChange={event => edit({ cc: event.target.value })}/></label>}
    {(showBcc || !!draft.bcc) && <label className="block text-sm">Bcc<Input disabled={locked} value={draft.bcc} onChange={event => edit({ bcc: event.target.value })}/></label>}
    <label className="block text-sm">Subject<Input disabled={locked} value={draft.subject} onChange={event => edit({ subject: event.target.value })}/></label>
    <label className="block text-sm">Message<Textarea aria-label="Message" className="min-h-48" disabled={locked} value={draft.body} onChange={event => edit({ body: event.target.value })}/></label>
      <label className="block text-sm">Attachments (10 MiB total)<input className="mt-1 block w-full text-sm" type="file" multiple disabled={locked} onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ''
        void run(async () => {
          if (!mailService.getSnapshot().editor) mailService.startDraft()
          const current = mailService.getSnapshot().editor!
          if (files.reduce((n, f) => n + f.size, current.draft.attachments.reduce((n, a) => n + a.bytes.length, 0)) > MAIL_ATTACHMENT_LIMIT) throw new Error('Attachments must total 10 MiB or less.')
          const attachments = await Promise.all(files.map(async file => ({ name: file.name, mimeType: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) })))
          if (mailService.getSnapshot().editor !== current) throw new Error('The composer changed. Select the files again.')
          mailService.editDraft({ attachments: [...current.draft.attachments, ...attachments] })
        })
      }}/></label>
      <ul>{draft.attachments.map((attachment, index) => <li key={index} className="flex items-center justify-between gap-2 text-sm"><span>{attachment.name}</span><Button variant="ghost" size="sm" disabled={locked} aria-label={`Remove ${attachment.name}`} onClick={() => edit({ attachments: draft.attachments.filter((_, i) => i !== index) })}>Remove</Button></li>)}</ul>
      {editor && <><p role="status" className="text-sm text-muted-foreground">{editor.status === 'saving' ? 'Saving…' : editor.status === 'sending' ? 'Sending…' : editor.status === 'saved' ? 'Saved in Gmail' : editor.status === 'uncertain' ? 'Check Sent before retrying' : 'Unsaved edits · kept in this tab'}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || state.status !== 'connected'} onClick={() => void run(async () => { await mailService.sendDraft(); resetRecipients(); setNotice('Sent.') })}>Send</Button><Button variant="outline" disabled={locked || state.status !== 'connected'} onClick={() => void run(() => mailService.saveDraft())}>Save draft</Button>
        {editor.error.includes('changed in Gmail') && <Button variant="outline" disabled={locked} onClick={() => void run(() => mailService.saveAsNew())}>Save as new draft</Button>}
        <Button variant="outline" disabled={busy || editor.status === 'sending' || editor.status === 'saving' || editor.status === 'uncertain'} onClick={() => void run(() => close())}>Close</Button>
        <Button variant="ghost" disabled={busy || editor.status === 'sending' || editor.status === 'saving'} onClick={() => { if (window.confirm(editor.status === 'uncertain' ? 'Have you checked Sent? Closing this editor does not undo a possible send.' : 'Discard unsaved edits? Any previously saved Gmail draft remains.')) void run(() => close(true)) }}>Discard unsaved edits</Button>
        {editor.id && editor.status !== 'uncertain' && <Button variant="ghost" disabled={locked || state.status !== 'connected' || editor.status === 'saving'} onClick={() => { if (window.confirm('Delete this saved Gmail draft?')) void run(async () => { await mailService.deleteDraft(); resetRecipients() }) }}>Delete Gmail draft</Button>}
      </div>
    </>}
    {!editor && <div className="flex gap-2"><Button disabled>Send</Button><Button variant="outline" disabled>Save draft</Button></div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {(error || editor?.error) && <p role="alert" className="text-sm text-destructive">{error || editor?.error}</p>}
  </div>
}
export function MailInboxWidget() { return <MailInbox/> }
export function MailMessageWidget() { return <MailMessageView/> }
export function MailComposeWidget() { return <MailComposer/> }
export function MailBoundWidget({ instance, update }: { instance: WidgetInstance; update: (instance: WidgetInstance) => void }) {
  const state = useMail(), binding = instance.binding
  useEffect(() => { if (binding.kind === 'gmail' && !binding.accountId && state.status === 'connected') update({ ...instance, binding: { ...binding, accountId: state.accountId } }) }, [state.accountId, state.status, binding, instance, update])
  useEffect(() => {
    if (binding.kind !== 'gmail' || instance.widgetType !== 'mail-compose' || binding.accountId !== state.accountId) return
    if (state.editor?.id && binding.draftId !== state.editor.id) update({ ...instance, binding: { ...binding, draftId: state.editor.id } })
    if (binding.draftId && state.sentDraftId === binding.draftId && !state.editor) update({ ...instance, binding: { ...binding, draftId: undefined } })
  }, [binding, instance, state.accountId, state.editor, state.sentDraftId, update])
  if (binding.kind !== 'gmail') return null
  if (instance.widgetType === 'mail-compose' && state.editor && binding.accountId === state.accountId && state.status !== 'connected') return <MailComposer/>
  return <MailAccess accountId={binding.accountId}>{instance.widgetType === 'mail-inbox' ? <MailInbox folder={instance.viewState.mailFolder} onFolder={mailFolder => update({ ...instance, viewState: { ...instance.viewState, mailFolder } })} onSelect={messageId => update({ ...instance, binding: { ...binding, messageId } })}/> : instance.widgetType === 'mail-message' ? <MailMessageView messageId={binding.messageId}/> : <MailComposer/>}</MailAccess>
}
