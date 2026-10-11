import { useState } from 'react'
import { demoSeedService } from '@/services'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { Button } from '@/components/ui/button'
export function LocalDataSettings() {
  const { resetDemo, notify } = useWorkspace()
  const [confirm, setConfirm] = useState(false)
  return <section className="space-y-3 border-t pt-4"><h3 className="text-sm font-medium">Local data</h3><p className="text-sm text-muted-foreground">Reset removes local records, notes, attachments, layouts, pins and preferences. External calendars are unaffected.</p>
    {confirm ? <div className="flex flex-wrap gap-2"><Button variant="destructive" onClick={() => { setConfirm(false); resetDemo() }}>Confirm reset local data</Button><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button></div> : <Button variant="destructive" onClick={() => setConfirm(true)}>Reset local data</Button>}
    <Button className="ml-2" variant="outline" onClick={() => { const result = demoSeedService.seed(); notify(result.ok ? 'Sample data added.' : result.message) }}>Seed sample data</Button>
  </section>
}
