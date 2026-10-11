import { X } from 'lucide-react'
import { useWorkspace } from '@/state/WorkspaceProvider'
import { browserDatabase } from '@/services'
import { getActivityRecords } from '@/services/recordHistory'
export function RecordNotice(){
 const {notice,notify,undo,state}=useWorkspace()
 if(!notice)return null
 const latest=getActivityRecords(browserDatabase)[0]
 const undoable=state.history.length>0&&!!latest&&['task','toggle','event','delete-event','delete-task','draft','delete-draft','rename-draft','dismiss','undo'].includes(latest.operation)
 return <div className="notice-toast" role="status"><span>{notice}</span>{undoable&&<button onClick={()=>{undo();notify('Record change undone.')}}>Undo record change</button>}<button onClick={()=>notify('')} aria-label="Dismiss message"><X size={16}/></button></div>
}
