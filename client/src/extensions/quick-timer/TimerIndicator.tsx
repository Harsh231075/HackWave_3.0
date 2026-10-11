import { useState } from 'react'
import { Timer } from 'lucide-react'
import { timerService } from '@/services'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { QuickTimer } from './QuickTimer'
export function TimerIndicator() {
  const [open, setOpen] = useState(false), timer = timerService.get(), remaining = timerService.remaining(timer)
  return <>{timer?.status === 'running' && <Button variant="outline" size="sm" aria-label="Open running timer" onClick={() => setOpen(true)}><Timer size={14}/>{Math.floor(remaining / 60000)}:{Math.floor(remaining / 1000 % 60).toString().padStart(2, '0')}</Button>}<Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Quick Timer</DialogTitle></DialogHeader><QuickTimer standalone/></DialogContent></Dialog></>
}
