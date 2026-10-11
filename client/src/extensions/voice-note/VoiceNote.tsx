import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Download, Mic, Square } from 'lucide-react'
import { browserDatabase, extensionService, recordingController, voiceNoteService } from '@/services'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
export function AudioPreview({ blob }: { blob: Blob }) {
  const element=useRef<HTMLAudioElement>(null)
  useEffect(()=>{const next=URL.createObjectURL(blob);if(element.current)element.current.src=next;return ()=>URL.revokeObjectURL(next)},[blob])
  return <audio ref={element} aria-label="Voice note playback" controls className="w-full"/>
}
export function VoiceNotePlayback({ noteId }: { noteId: string }) {
  const audioId = voiceNoteService.forNote(noteId)?.audioId
  const [audio, setAudio] = useState<{ id: string; blob?: Blob; error?: string }>()
  useEffect(() => { let current = true; if (audioId) voiceNoteService.getAudio(audioId).then(blob => { if (current) setAudio({ id: audioId, ...(blob ? { blob } : { error: 'Audio is unavailable on this device.' }) }) }).catch(() => { if (current) setAudio({ id: audioId, error: 'Audio storage is unavailable. Retry by reopening the note.' }) }); return () => { current = false } }, [audioId])
  if (!audioId || audio?.id !== audioId) return null
  return audio.blob ? <AudioPreview blob={audio.blob}/> : <p role="alert" className="text-sm text-destructive">{audio.error}</p>
}
export function VoiceNote() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const state = useSyncExternalStore(recordingController.subscribe, recordingController.getSnapshot, recordingController.getSnapshot)
  const enabled = extensionService.isEnabled('voice-note')
  const [saving, setSaving] = useState(false), [error, setError] = useState('')
  useEffect(() => () => recordingController.stop(), [])
  async function save() {
    const draft = recordingController.getSnapshot().draft; if (!draft || saving) return
    setSaving(true); setError('')
    const result = await voiceNoteService.save(draft.blob, draft.durationMs, draft.title, draft.text)
    if (result.ok) recordingController.saved(draft); else setError(result.message)
    setSaving(false)
  }
  return <div className="space-y-4" aria-label="Voice Note"><div className="flex flex-wrap gap-2">{state.status === 'idle' ? <Button disabled={!enabled || !!state.draft || saving} onClick={() => void recordingController.start()}><Mic size={14}/>Record</Button> : <Button variant="outline" disabled={state.status === 'stopping'} onClick={recordingController.stop}><Square size={14}/>{state.status === 'requesting' ? 'Cancel microphone request' : 'Stop recording'}</Button>}</div><p role="status" className="text-xs text-muted-foreground">{state.status === 'recording' ? 'Recording · up to 2 minutes' : state.status === 'requesting' ? 'Waiting for microphone permission…' : state.status === 'stopping' ? 'Finishing recording…' : 'Audio stays on this device. No automatic transcription.'}</p>
  {state.draft && <div className="space-y-3"><AudioPreview blob={state.draft.blob}/><Input disabled={saving} aria-label="Voice note title" placeholder="Title" maxLength={160} value={state.draft.title} onChange={event => recordingController.updateDraft({ title: event.target.value })}/><Textarea disabled={saving} aria-label="Voice note text" placeholder="Optional text or transcript" maxLength={5000} value={state.draft.text} onChange={event => recordingController.updateDraft({ text: event.target.value })}/><div className="flex flex-wrap gap-2"><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save voice note'}</Button><Button variant="outline" disabled={saving} onClick={recordingController.discard}>Discard</Button><Button variant="outline" onClick={() => { const draft = recordingController.getSnapshot().draft; if (!draft) return; const url = URL.createObjectURL(draft.blob), link = document.createElement('a'); link.href = url; link.download = `voice-note.${draft.blob.type.includes('mp4') ? 'm4a' : draft.blob.type.includes('ogg') ? 'ogg' : 'webm'}`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }}><Download size={14}/>Download</Button></div></div>}
  {(state.error || error) && <p role="alert" className="text-sm text-destructive">{error || state.error}</p>}{!enabled && state.draft && <p className="text-xs text-muted-foreground">Voice Note is disabled. You can still save or download this recording.</p>}</div>
}
