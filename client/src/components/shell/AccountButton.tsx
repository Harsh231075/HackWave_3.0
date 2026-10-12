import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { authClient } from '@/lib/authClient'
import { cloudStore } from '@/services/cloudStore'
import { mailService } from '@/extensions/mail/mailRuntime'
import { Button } from '@/components/ui/button'

export function AccountButton() {
  const [pending, setPending] = useState(false), [error, setError] = useState('')
  const navigate = useNavigate()
  return <div><Button size="icon-sm" variant="ghost" disabled={pending} aria-label="Sign out" onClick={async () => {
    setPending(true); setError('')
    try {
      const result = await authClient.signOut()
      if (result.error) { setError(result.error.message ?? 'Unable to sign out.'); return }
      cloudStore.clear(); mailService.disconnect(true); navigate('/sign-in', { replace: true })
    } catch { setError('Unable to sign out. Try again.') }
    finally { setPending(false) }
  }}><LogOut size={18}/></Button>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>
}
