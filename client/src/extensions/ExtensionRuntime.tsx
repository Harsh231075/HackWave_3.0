import { useEffect, useState, useSyncExternalStore } from 'react'
import { Mic } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { browserDatabase, timerService, recordingController } from '@/services'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TimerIndicator } from './quick-timer/TimerIndicator'
import { VoiceNote } from './voice-note/VoiceNote'
export function ExtensionRuntime() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const state = useSyncExternalStore(recordingController.subscribe, recordingController.getSnapshot, recordingController.getSnapshot), location = useLocation()
  const [open, setOpen] = useState(false), [, refresh] = useState(0), [error, setError] = useState('')
  useEffect(() => { const tick = () => { const result = timerService.tick(); if (!result.ok) setError(result.message); if(timerService.get()?.status==='running')refresh(value => value + 1) }; tick(); const interval = setInterval(tick, 500); return () => clearInterval(interval) }, [])
  useEffect(() => { recordingController.stop() }, [location.pathname])
  useEffect(() => { const handler = (event: BeforeUnloadEvent) => { const recording = recordingController.getSnapshot(); if (recording.status !== 'idle' || recording.draft) { event.preventDefault(); event.returnValue = '' } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler) }, [])
  const active = timerService.get()?.status === 'running' || state.status !== 'idle' || !!state.draft
  return <><PageHeaderActions active={active}><TimerIndicator/>{(state.status !== 'idle' || state.draft) && <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Mic size={14}/>{state.status === 'recording' ? 'Recording' : 'Recording draft'}</Button>}</PageHeaderActions>{(error || state.error) && <p role="alert" className="px-6 text-sm text-destructive">{error || state.error}</p>}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Voice Note</DialogTitle></DialogHeader><VoiceNote/></DialogContent></Dialog></>
}
