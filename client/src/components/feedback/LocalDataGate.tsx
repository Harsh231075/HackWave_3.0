import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { localDataService } from '@/services'
import { Button } from '@/components/ui/button'
export function LocalDataGate({children}:{children:ReactNode}){
  const state=useSyncExternalStore(localDataService.subscribe,localDataService.getSnapshot,localDataService.getSnapshot)
  useEffect(()=>{void localDataService.initialize()},[])
  if(state.status==='ready')return children
  return <main className="flex min-h-screen items-center justify-center p-6"><div className="max-w-md space-y-4"><p role={state.status==='error'?'alert':'status'}>{state.status==='error'?state.message:'Preparing local data…'}</p>{state.status==='error'&&<div className="flex gap-2"><Button onClick={()=>void localDataService.initialize()}>Retry</Button><Button variant="outline" onClick={()=>{if(window.confirm('Remove local records, notes, audio, layouts and extension data?'))void localDataService.reset()}}>Reset local data</Button></div>}</div></main>
}
