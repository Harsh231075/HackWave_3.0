import { useId, useRef, useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SaveFeedback } from '@/components/feedback/common'
import { browserDatabase } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import type { ActionResult } from '@/domain/commands'
export function DraftEditor({ draftKey, label, fallback = '', onSave }: { draftKey: string; label: string; fallback?: string; onSave?: (value: string) => ActionResult<void> | Promise<ActionResult<void>> }) {
  const { state, draftBuffers, editDraft, saveDraft, notify } = useWorkspace()
  const id = useId()
  const value = draftBuffers[draftKey] ?? state.drafts[draftKey] ?? fallback
  const dirty = value !== (state.drafts[draftKey] ?? fallback)
  const baseline = useRef({ saved: state.drafts[draftKey], fallback })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  return <div className="flex flex-col gap-3"><label htmlFor={id} className="text-sm font-medium">{label}</label><Textarea id={id} value={value} onChange={event => { if (!dirty) baseline.current = { saved: state.drafts[draftKey], fallback }; editDraft(draftKey, event.target.value); setSaved(false) }} rows={7} maxLength={5000} placeholder="Add your plan, talking points, or next steps…" /><div className="flex justify-between items-center gap-2"><span className="text-xs text-muted-foreground">{dirty ? 'Unsaved draft · kept while switching views' : 'Saved draft'}</span><Button size="sm" disabled={!dirty} onClick={async () => { if ((browserDatabase.getState().drafts[draftKey] !== baseline.current.saved || fallback !== baseline.current.fallback)) { setError('The saved draft changed. Your unsaved text is kept; review the current draft before saving.'); return }; const result = await (onSave ? onSave(value) : saveDraft(draftKey, value)); if (!result.ok) { setError(result.message); return }; baseline.current = { saved: value, fallback }; setError(''); setSaved(true); notify(`${label} saved.`,'success') }}><Save size={14} /> Save draft</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<SaveFeedback saved={saved && !dirty} message={browserDatabase.getPersistenceResult().status === 'saved' ? 'Saved' : 'Saved for this session'} /></div>
}
