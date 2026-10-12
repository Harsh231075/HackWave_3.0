import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authClient } from '@/lib/authClient'
import { cloudStore } from '@/services/cloudStore'
import { mailService } from '@/extensions/mail/mailRuntime'
import { Button } from '@/components/ui/button'

export function BackendGate({ children }: { children: ReactNode }) {
  const { data: session, isPending, error, refetch } = authClient.useSession()
  const userId = session?.user.id
  const location = useLocation()
  const state = useSyncExternalStore(cloudStore.subscribe, cloudStore.getSnapshot, cloudStore.getSnapshot)
  useEffect(() => {
    if (isPending || !userId) return
    void cloudStore.initialize(userId)
    return () => { cloudStore.clear(); mailService.disconnect(true) }
  }, [isPending, userId])
  if (error) return <main className="flex min-h-screen items-center justify-center gap-3 p-6"><p role="alert">Unable to verify your session.</p><Button onClick={() => void refetch()}>Retry</Button></main>
  if (!isPending && !userId) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />
  if (state.status === 'ready' && cloudStore.isCurrent(userId ?? '')) return <>{children}<BackendSaveStatus /></>
  return <main className="flex min-h-screen items-center justify-center p-6"><div className="max-w-md space-y-4"><p role={state.status === 'error' ? 'alert' : 'status'}>{state.status === 'error' ? state.message : 'Loading your data…'}</p>{state.status === 'error' && userId && <Button onClick={() => void cloudStore.initialize(userId)}>Retry</Button>}</div></main>
}
function BackendSaveStatus() {
  const state = useSyncExternalStore(cloudStore.subscribe, cloudStore.getSnapshot, cloudStore.getSnapshot)
  if (!state.message && !state.pending) return null
  return <div role={state.message ? 'alert' : 'status'} className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border bg-background px-3 py-2 text-sm shadow-sm">{state.message || 'Saving…'}</div>
}
