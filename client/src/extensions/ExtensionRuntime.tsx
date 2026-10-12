import { useEffect, useState, useSyncExternalStore } from 'react'
import { browserDatabase, timerService } from '@/services'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { TimerIndicator } from './quick-timer/TimerIndicator'
export function ExtensionRuntime() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const [error, setError] = useState(''), [, refresh] = useState(0)
  useEffect(() => {
    let pending = false, alive = true
    const tick = async () => {
      if (alive) refresh(value => value + 1)
      const timer = timerService.get()
      if (pending || !timer || timer.status !== 'running' || timerService.remaining(timer) > 0) return
      pending = true
      const result = await timerService.tick()
      if (alive && !result.ok) setError(result.message)
      pending = false
    }
    const interval = setInterval(() => void tick(), 1000)
    return () => { alive = false; clearInterval(interval) }
  }, [])
  return <><PageHeaderActions active={timerService.get()?.status === 'running'}><TimerIndicator/></PageHeaderActions>{error && <p role="alert" className="px-6 text-sm text-destructive">{error}</p>}</>
}
