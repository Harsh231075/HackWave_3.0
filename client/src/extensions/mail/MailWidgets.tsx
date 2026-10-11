import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { browserDatabase, extensionService } from '@/services'
import { mailFolders, MAIL_ATTACHMENT_LIMIT, replyDraft, type MailAttachment, type MailFolder, type MailMessage } from '@/domain/mail'
import type { WidgetInstance } from '@/domain/widgetInstances'
import { mailService } from './mailRuntime'
import { useMail } from './useMail'
import { loadMailIdentity } from './googleIdentity'
import { mailDocument, mailPlainText } from './safeMail'

const inputClass = 'w-full rounded-md border bg-background px-3 py-2 text-sm'

function messageOf(error: unknown) { return error instanceof Error ? error.message : 'Mail could not complete this operation.' }
export function MailConnection() {
  const state = useMail(), [error, setError] = useState(''), [ready, setReady] = useState(false)
  useEffect(() => {
    if (!state.configured) return
    let active = true
    void loadMailIdentity().then(() => { if (active) setReady(true) }).catch(error => { if (active) setError(messageOf(error)) })
    return () => { active = false }
  }, [state.configured])
  async function run(operation: () => Promise<unknown> | void) { setError(''); try { await operation() } catch (error) { setError(messageOf(error)) } }
  return <section className="space-y-2" aria-label="Gmail connection">
    {!state.configured ? <p>Configure <code>VITE_GOOGLE_CLIENT_ID</code> to connect Gmail. <a className="underline" href="https://developers.google.com/workspace/gmail/api/quickstart/js" target="_blank" rel="noreferrer">Google setup guide</a></p> : <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">{state.email ?? 'Gmail is not connected'}{state.status === 'expired' ? ' · Access expired' : ''}</span>
      {state.status !== 'connected' ? <Button size="sm" disabled={state.status === 'connecting' || !ready} onClick={() => void run(() => mailService.connect())}>{state.status === 'connecting' ? 'Connecting…' : !ready ? 'Loading Google sign-in…' : state.accountId ? 'Reconnect' : 'Connect Gmail'}</Button> : <>
        <Button size="sm" variant="outline" onClick={() => void run(() => mailService.disconnect())}>Disconnect</Button>
        <Button size="sm" variant="ghost" onClick={() => void run(() => mailService.revoke())}>Revoke Google access</Button>
      </>}
      {state.status === 'expired' && <a href="https://myaccount.google.com/connections" className="text-sm underline" target="_blank" rel="noreferrer">Google account permissions</a>}
    </div>}
    {(error || state.error) && <p role="alert" className="text-sm text-destructive">{error || state.error}</p>}
  </section>
}
export function MailRuntime() {
  const state = useMail()
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (mailService.hasUnsaved()) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', unload)
    const unregister = extensionService.beforeDisable(id => { if (id === 'mail') mailService.disconnect() })
    return () => { window.removeEventListener('beforeunload', unload); unregister() }
  }, [])
  const epoch = useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getEpoch, browserDatabase.getEpoch)
  const previousEpoch = useRef(epoch)
  useEffect(() => { if (previousEpoch.current !== epoch) { mailService.disconnect(true); previousEpoch.current = epoch } }, [epoch])
  return state.editor && <div className="flex items-center gap-2 px-6 py-2 text-sm" role="status"><span>{state.editor.status === 'uncertain' ? 'Mail send needs review' : 'Mail draft open'}</span><Link to="/mail" className="underline">Open Mail</Link></div>
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
  const generation = useRef(0), request = useRef<AbortController | null>(null)
  useEffect(() => { setFolder(initialFolder) }, [initialFolder])
  function invalidateReads() { request.current?.abort(); generation.current++ }
  async function load(next = '') {
    request.current?.abort(); const controller = new AbortController(); request.current = controller
    const id = ++generation.current; setLoading(true); setError('')
    try {
      const result = await mailService.listMessages(folder, search, next, controller.signal)
      if (id !== generation.current) return
      setRows(previous => next ? [...previous, ...result.messages.filter(row => !previous.some(p => p.message.id === row.message.id))] : result.messages); setPage(result.nextPageToken)
    } catch (error) { if (id === generation.current) setError(messageOf(error)) } finally { if (id === generation.current) setLoading(false) }
  }
  useEffect(() => {
    setRows([]); setPage(undefined)
    if (state.status !== 'connected') return
    void load()
    return invalidateReads
    // The connection and service revision invalidate mailbox results.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search, state.status, state.accountId, state.revision])
  useEffect(() => {
    const refresh = () => { if (!document.hidden && state.status === 'connected' && !loading) void load() }
    const interval = setInterval(refresh, 60000); window.addEventListener('focus', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, search, state.status, state.accountId, loading])
  async function open(row: { message: MailMessage; draftId?: string }) {
    try { if (row.draftId) await mailService.openDraft(row.draftId); else { mailService.selectMessage(row.message.id); if (onSelect) onSelect(row.message.id); else setSelected(row.message.id) } } catch (error) { setError(messageOf(error)) }
  }
  const [selected, setSelected] = useState<string>()
  return <MailAccess><div className="space-y-3">
    <div className="flex flex-wrap gap-1" aria-label="Mail folders">{mailFolders.map(item => <Button key={item} size="sm" variant={folder === item ? 'default' : 'outline'} onClick={() => { setFolder(item); onFolder?.(item); setSelected(undefined) }}>{item}</Button>)}</div>
    <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSearch(query) }}><input className={inputClass} aria-label="Search Gmail" placeholder="Search Gmail (supports Gmail search syntax)" value={query} onChange={event => setQuery(event.target.value)}/><Button type="submit" variant="outline">Search</Button></form>
    <div className="flex gap-2"><Button size="sm" onClick={() => { try { mailService.startDraft() } catch (error) { setError(messageOf(error)) } }}>Compose</Button><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>Refresh</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p role="status" className="text-sm text-muted-foreground">{loading ? 'Loading mail…' : !rows.length && !error ? 'No messages found.' : `${rows.length} ${rows.length === 1 ? 'message' : 'messages'} loaded`}</p>
    <ul className="divide-y rounded-md border">{rows.map(row => <li key={row.draftId ?? row.message.id}><button className="w-full space-y-1 p-3 text-left hover:bg-muted focus-visible:outline-2" onClick={() => void open(row)}><span className="flex justify-between gap-2"><span className={row.message.labels.includes('UNREAD') ? 'font-semibold' : ''}>{row.message.from || 'Draft'}</span><span className="shrink-0 text-xs text-muted-foreground">{row.message.date ? new Date(row.message.date).toLocaleDateString() : ''}</span></span><span className="block text-sm">{row.message.labels.includes('UNREAD') && <span aria-label="Unread">● </span>}{row.message.subject}</span><span className="block truncate text-xs text-muted-foreground">{row.message.snippet}</span></button></li>)}</ul>
    {page && <Button variant="outline" disabled={loading} onClick={() => void load(page)}>Load more</Button>}
    {selected && <MailMessageView messageId={selected}/>}{state.editor && !onSelect && <MailComposer/>}
  </div></MailAccess>
}
export function MailMessageView({ messageId: boundMessageId }: { messageId?: string }) {
  const state = useMail(), [message, setMessage] = useState<MailMessage>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [plain, setPlain] = useState(false)
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
  return <MailAccess><div className="space-y-3">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!message ? <p role="status">{messageId ? error ? 'Message unavailable.' : 'Loading message…' : 'Select a message from your inbox.'}</p> : <>
      <h2 className="text-lg font-medium">{message.subject}</h2><div className="text-sm text-muted-foreground"><p>From: {message.from}</p><p>To: {message.to}</p>{message.cc && <p>Cc: {message.cc}</p>}<p>{message.date ? new Date(message.date).toLocaleString() : ''}</p></div>
      <div className="flex flex-wrap gap-1">{(['reply', 'reply-all', 'forward'] as const).map(mode => <Button key={mode} size="sm" variant="outline" disabled={busy} onClick={() => void run(() => mailService.startDraft(replyDraft(message, state.email!, mode, mailPlainText(message.html))))}>{mode === 'reply-all' ? 'Reply All' : mode === 'reply' ? 'Reply' : 'Forward'}</Button>)}
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
  </div></MailAccess>
}
export function MailComposer() {
  const state = useMail(), editor = state.editor, [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false)
  async function run(operation: () => Promise<unknown> | void) { setBusy(true); setError(''); try { await operation() } catch (error) { setError(messageOf(error)) } finally { setBusy(false) } }
  const locked = busy || editor?.status === 'sending' || editor?.status === 'uncertain'
  return <div className="space-y-3" aria-label="Mail composer">
    {state.status !== 'connected' && <MailConnection/>}
    {!editor ? <><p className="text-sm text-muted-foreground">Compose a message. Gmail saves your drafts; unsaved edits remain in this tab.</p><Button disabled={state.status !== 'connected'} onClick={() => void run(() => mailService.startDraft())}>New email</Button>{notice && <p role="status">{notice}</p>}</> : <>
      <h2 className="font-medium">Compose mail</h2><p className="text-sm text-muted-foreground">From: {state.email}</p>
      {(['to', 'cc', 'bcc', 'subject'] as const).map(field => <label key={field} className="block text-sm">{field === 'subject' ? 'Subject' : field === 'to' ? 'To' : field === 'cc' ? 'Cc' : 'Bcc'}<input className={inputClass} disabled={locked} value={editor.draft[field]} onChange={event => mailService.editDraft({ [field]: event.target.value })}/></label>)}
      <label className="block text-sm">Message<textarea aria-label="Message" className={inputClass + ' min-h-48'} disabled={locked} value={editor.draft.body} onChange={event => mailService.editDraft({ body: event.target.value })}/></label>
      <label className="block text-sm">Attachments (10 MiB total)<input className="mt-1 block w-full text-sm" type="file" multiple disabled={locked} onChange={event => {
        const files = Array.from(event.target.files ?? []); event.target.value = ''
        void run(async () => {
          const current = mailService.getSnapshot().editor!
          if (files.reduce((n, f) => n + f.size, current.draft.attachments.reduce((n, a) => n + a.bytes.length, 0)) > MAIL_ATTACHMENT_LIMIT) throw new Error('Attachments must total 10 MiB or less.')
          const attachments = await Promise.all(files.map(async file => ({ name: file.name, mimeType: file.type || 'application/octet-stream', bytes: new Uint8Array(await file.arrayBuffer()) })))
          if (mailService.getSnapshot().editor !== current) throw new Error('The composer changed. Select the files again.')
          mailService.editDraft({ attachments: [...current.draft.attachments, ...attachments] })
        })
      }}/></label>
      <ul>{editor.draft.attachments.map((attachment, index) => <li key={index} className="flex items-center justify-between gap-2 text-sm"><span>{attachment.name}</span><Button variant="ghost" size="sm" disabled={locked} aria-label={`Remove ${attachment.name}`} onClick={() => mailService.editDraft({ attachments: editor.draft.attachments.filter((_, i) => i !== index) })}>Remove</Button></li>)}</ul>
      <p role="status" className="text-sm text-muted-foreground">{editor.status === 'saving' ? 'Saving…' : editor.status === 'sending' ? 'Sending…' : editor.status === 'saved' ? 'Saved in Gmail' : editor.status === 'uncertain' ? 'Check Sent before retrying' : 'Unsaved edits · kept in this tab'}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={locked || state.status !== 'connected'} onClick={() => void run(async () => { await mailService.sendDraft(); setNotice('Sent.') })}>Send</Button><Button variant="outline" disabled={locked || state.status !== 'connected'} onClick={() => void run(() => mailService.saveDraft())}>Save draft</Button>
        {editor.error.includes('changed in Gmail') && <Button variant="outline" disabled={locked} onClick={() => void run(() => mailService.saveAsNew())}>Save as new draft</Button>}
        <Button variant="outline" disabled={busy || editor.status === 'sending' || editor.status === 'saving' || editor.status === 'uncertain'} onClick={() => void run(() => mailService.closeDraft())}>Close</Button>
        <Button variant="ghost" disabled={busy || editor.status === 'sending' || editor.status === 'saving'} onClick={() => { if (window.confirm(editor.status === 'uncertain' ? 'Have you checked Sent? Closing this editor does not undo a possible send.' : 'Discard unsaved edits? Any previously saved Gmail draft remains.')) void run(() => mailService.closeDraft(true)) }}>Discard unsaved edits</Button>
        {editor.id && editor.status !== 'uncertain' && <Button variant="ghost" disabled={locked || state.status !== 'connected' || editor.status === 'saving'} onClick={() => { if (window.confirm('Delete this saved Gmail draft?')) void run(() => mailService.deleteDraft()) }}>Delete Gmail draft</Button>}
      </div>
    </>}
    {(error || editor?.error) && <p role="alert" className="text-sm text-destructive">{error || editor?.error}</p>}
  </div>
}
export function MailPage() {
  const [selected, setSelected] = useState<string>()
  return <main id="main-content" className="shared-page-content space-y-5" tabIndex={-1}><h1 className="text-xl font-medium">Mail</h1><MailConnection/><MailAccess><div className="grid items-start gap-6 xl:grid-cols-2"><MailInbox onSelect={setSelected}/><div className="space-y-6"><MailMessageView messageId={selected}/></div></div></MailAccess>{extensionService.isEnabled('mail') && <MailComposer/>}</main>
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
  const [error, setError] = useState('')
  if (binding.kind !== 'gmail') return null
  if (instance.widgetType === 'mail-compose' && state.editor && binding.accountId === state.accountId && state.status !== 'connected') return <MailComposer/>
  return <MailAccess accountId={binding.accountId}>{instance.widgetType === 'mail-inbox' ? <MailInbox folder={instance.viewState.mailFolder} onFolder={mailFolder => update({ ...instance, viewState: { ...instance.viewState, mailFolder } })} onSelect={messageId => update({ ...instance, binding: { ...binding, messageId } })}/> : instance.widgetType === 'mail-message' ? <MailMessageView messageId={binding.messageId}/> : <>{binding.draftId && !state.editor && <Button variant='outline' onClick={()=>{setError('');void mailService.openDraft(binding.draftId!).catch(error=>setError(messageOf(error)))}}>Reopen saved draft</Button>}<MailComposer/>{error && <p role='alert'>{error}</p>}</>}{instance.widgetType === 'mail-inbox' && binding.messageId && <MailMessageView messageId={binding.messageId}/>}</MailAccess>
}
