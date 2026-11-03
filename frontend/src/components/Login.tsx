import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, AUTH_EVENT, type AuthState } from '@/lib/api'

interface AuthCtx { user: string | null; required: boolean; logout: () => void }
const Ctx = createContext<AuthCtx>({ user: null, required: false, logout: () => {} })
export const useAuth = () => useContext(Ctx)

/** Login gate for hosted demos. Off when the server has no users configured (local development). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [state, setState] = useState<AuthState | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    api.me().then(setState).catch(() => setFailed(true))
    const expire = () => setState((s) => (s ? { ...s, user: null } : s))
    window.addEventListener(AUTH_EVENT, expire)
    return () => window.removeEventListener(AUTH_EVENT, expire)
  }, [])
  const logout = () => api.logout().finally(() => { qc.clear(); setState((s) => (s ? { ...s, user: null } : s)) })
  if (failed) return <Centered><p className="text-[14px] text-muted-foreground">The server is not reachable. It may be waking up; refresh in a minute.</p></Centered>
  if (!state) return <Centered><Loader2 className="size-6 animate-spin text-navy" /></Centered>
  if (state.required && !state.user) return <Login onDone={(s) => { qc.clear(); setState(s) }} />
  return <Ctx.Provider value={{ user: state.user, required: state.required, logout }}>{children}</Ctx.Provider>
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-svh items-center justify-center bg-background px-6">{children}</div>
}

function Login({ onDone }: { onDone: (s: AuthState) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    api.login(username, password).then(onDone).catch((err: Error) => setError(err.message)).finally(() => setBusy(false))
  }
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-sm flex-col items-center">
        <img src="/kpmg-logo.png" alt="KPMG" className="h-20 w-auto object-contain" />
        <h1 className="mt-6 text-center text-[22px] leading-tight font-semibold text-navy">Enterprise Architecture Assessment Tool</h1>
        <p className="mt-1.5 text-center text-[13.5px] text-muted-foreground">Sign in to continue</p>
        <form onSubmit={submit} className="mt-6 w-full space-y-4 rounded-xl border bg-card p-6 shadow-sm">
          <div className="space-y-1.5">
            <Label htmlFor="username">Username</Label>
            <Input id="username" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="text-[12.5px] text-destructive">{error}</p>}
          <Button type="submit" className="h-10 w-full" disabled={busy || !username || !password}>
            {busy ? <Loader2 className="animate-spin" /> : <LogIn />} Sign In
          </Button>
        </form>
      </div>
      <p className="absolute bottom-6 text-[11.5px] text-muted-foreground">KPMG Enterprise Architecture · Confidential</p>
    </div>
  )
}
