import { useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { Check, Info, CircleAlert, X } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { browserDatabase } from '@/services'
import { getActivityRecords } from '@/services/recordHistory'

export function RecordNotice() {
  const workspace = useWorkspace()
  const current = useRef(workspace)
  useEffect(() => { current.current = workspace })
  const { notice, noticeVersion, noticeTone } = workspace
  useEffect(() => {
    if (!notice) { toast.dismiss('workspace-notice'); return }
    const { state } = current.current
    const latest = getActivityRecords(browserDatabase)[0]
    const undoable = state.history.length > 0 && !!latest && ['task','toggle','event','delete-event','delete-task','draft','delete-draft','rename-draft','dismiss','undo'].includes(latest.operation)
    const history = JSON.stringify(state.history)
    const success=noticeTone==='success', error=noticeTone==='error'
    toast.custom(t => <div role={error?'alert':'status'} className={`flex max-w-[calc(100vw-48px)] items-start gap-3 rounded-2xl border p-4 text-sm shadow-[0_8px_28px_rgba(37,41,54,.10)] ${success?'border-green-200 bg-green-50 text-green-900':error?'border-red-200 bg-red-50 text-red-900':'border-border bg-card text-foreground'} ${t.visible ? 'animate-in fade-in slide-in-from-top-2' : 'animate-out fade-out'}`}>
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full ${success?'bg-green-600 text-white':error?'bg-red-100 text-red-600':'bg-primary/10 text-primary'}`}>{success?<Check size={16} strokeWidth={2.5}/>:error?<CircleAlert size={16}/>:<Info size={16}/>}</span><div className="min-w-0 flex-1 pt-0.5"><p className="font-medium leading-6">{notice}</p>{undoable && <button className={`mt-2 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 ${success?'bg-green-100 text-green-800 hover:bg-green-200':'bg-muted text-foreground hover:bg-muted/70'}`} onClick={() => {
        if (JSON.stringify(browserDatabase.getState().history) !== history) { toast.dismiss(t.id); toast.error('Records changed. Review the latest change before undoing.'); return }
        current.current.undo(); current.current.notify('Record change undone.','success')
      }}>Undo record change</button>}</div>
      <button aria-label="Dismiss message" className="shrink-0 rounded p-0.5 text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary" onClick={() => { toast.dismiss(t.id); current.current.notify('') }}><X size={16}/></button>
    </div>, { id: 'workspace-notice', duration: 5000 })
  }, [notice, noticeVersion, noticeTone])
  useEffect(() => () => { toast.dismiss('workspace-notice') }, [])
  return null
}
