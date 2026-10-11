import { useState, useSyncExternalStore, useEffect } from 'react'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { browserDatabase, extensionService, timerService } from '@/services'
import { useComponentView } from '@/state/ComponentViewContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
export function QuickTimer({ standalone = false }: { standalone?: boolean }) {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const component = useComponentView()
  const [duration, setDuration] = useState(component?.plan.bindings.timerDurationMinutes ?? 25), [error, setError] = useState(''), [, refresh] = useState(0)
  useEffect(() => { const interval = setInterval(() => refresh(value => value + 1), 500); return () => clearInterval(interval) }, [])
  const timer = timerService.get(), remaining = timerService.remaining(timer), enabled = extensionService.isEnabled('quick-timer')
  const report = (result: { ok: boolean; message?: string }) => setError(result.ok ? '' : result.message ?? 'Unable to update timer.')
  return <div className="space-y-4" aria-label="Quick Timer"><p role="timer" className="text-center text-4xl font-medium tabular-nums">{timer ? `${Math.floor(remaining / 60000).toString().padStart(2, '0')}:${Math.floor(remaining / 1000 % 60).toString().padStart(2, '0')}` : `${duration.toString().padStart(2, '0')}:00`}</p>{timer && <p className="text-center text-xs text-muted-foreground">Focus session · {timer.status}</p>}
  {(!timer || timer.status === 'finished') && <div className="space-y-3"><label className="block text-sm">Duration (minutes)<Input aria-label="Timer duration" type="number" min={1} max={180} value={duration} onChange={event => setDuration(Number(event.target.value))}/></label></div>}
  <div className="flex flex-wrap justify-center gap-2">{!timer || timer.status === 'finished' ? <Button disabled={!enabled} onClick={() => report(timerService.start(duration))}><Play size={14}/>Start</Button> : timer.status === 'running' ? <Button variant="outline" onClick={() => report(timerService.pause())}><Pause size={14}/>Pause</Button> : <Button disabled={!enabled} onClick={() => report(timerService.resume())}><Play size={14}/>Resume</Button>}{timer && <Button variant="outline" onClick={() => report(timerService.reset())}><RotateCcw size={14}/>Reset</Button>}</div>{!enabled && standalone && <p className="text-sm text-muted-foreground">Quick Timer is disabled. Enable it in Plugins to resume.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<p role="status" className="text-xs text-muted-foreground">{browserDatabase.getPersistenceResult().status === 'saved' ? 'Saved on this device' : 'Saved for this session'}</p></div>
}
