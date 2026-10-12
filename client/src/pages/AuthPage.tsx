import { useEffect, useState } from 'react'
import { Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { authClient } from '@/lib/authClient'
import { OrloLogo } from '@/components/shell/OrloLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AuthPage({ signUp = false }: { signUp?: boolean }) {
  const { data: session, isPending } = authClient.useSession()
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [google, setGoogle] = useState(false)
  const navigate = useNavigate(), location = useLocation()
  const requested = (location.state as { from?: unknown } | null)?.from
  const destination = typeof requested === 'string' && requested.startsWith('/') && !requested.startsWith('//') && !/^\/(sign-in|sign-up|login|signup)(?:[/?#]|$)/.test(requested) ? requested : '/'
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/auth-config', { signal: controller.signal }).then(async response => { if (response.ok) setGoogle((await response.json() as { googleEnabled: boolean }).googleEnabled) }).catch(() => { /* Email auth reports configuration/network failures on submit. */ })
    return () => controller.abort()
  }, [])
  if (isPending) return <main className="flex min-h-screen items-center justify-center bg-background"><LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-hidden="true"/><span role="status" className="sr-only">Checking your session…</span></main>
  if (session) return <Navigate to={destination} replace/>
  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12"><div className="w-full max-w-sm space-y-6">
    <Link to="/landing" className="flex items-center justify-center gap-2 text-2xl font-semibold"><OrloLogo size={32}/>Orlo</Link>
    <h1 className="text-center text-xl font-medium">{signUp ? 'Create your account' : 'Welcome back'}</h1>
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault(); if (pending) return
      setPending(true); setError('')
      try {
        const result = signUp ? await authClient.signUp.email({ email: email.trim(), password, name: name.trim(), callbackURL: destination }) : await authClient.signIn.email({ email: email.trim(), password, callbackURL: destination })
        if (result.error) { setError(result.error.message ?? 'Unable to authenticate.'); return }
        navigate(destination, { replace: true })
      } catch { setError('Unable to connect. Try again.') }
      finally { setPending(false) }
    }}><fieldset disabled={pending} className="space-y-4">
      {signUp && <label className="block space-y-1 text-sm">Name<Input value={name} onChange={event => setName(event.target.value)} required autoComplete="name" maxLength={160}/></label>}
      <label className="block space-y-1 text-sm">Email<Input type="email" value={email} onChange={event => setEmail(event.target.value)} required autoComplete="email" maxLength={254}/></label>
      <div className="space-y-1 text-sm"><label htmlFor="auth-password">Password</label><div className="relative">
        <Input id="auth-password" type={showPassword ? 'text' : 'password'} className="pr-10" value={password} onChange={event => setPassword(event.target.value)} required minLength={signUp ? 8 : undefined} maxLength={128} autoComplete={signUp ? 'new-password' : 'current-password'}/>
        <Button type="button" variant="ghost" size="icon-sm" className="absolute right-1 top-1/2 -translate-y-1/2" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}</Button>
      </div>{signUp && <p className="text-xs text-muted-foreground">At least 8 characters</p>}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" aria-busy={pending}>{pending && <LoaderCircle className="size-4 animate-spin" aria-hidden="true"/>}{pending ? 'Please wait…' : signUp ? 'Create account' : 'Sign in'}</Button>
      {google && <Button type="button" variant="outline" className="w-full" onClick={async () => {
        setPending(true); setError('')
        try { const result = await authClient.signIn.social({ provider: 'google', callbackURL: destination }); if (result.error) setError(result.error.message ?? 'Unable to connect Google.') }
        catch { setError('Unable to connect Google. Try again.') }
        finally { setPending(false) }
      }}>Continue with Google</Button>}
    </fieldset></form>
    <p className="text-center text-sm text-muted-foreground">{signUp ? 'Already have an account? ' : 'New to Orlo? '}<Link to={signUp ? '/sign-in' : '/sign-up'} state={{ from: destination }} className="font-medium text-foreground underline">{signUp ? 'Sign in' : 'Create account'}</Link></p>
  </div></main>
}
