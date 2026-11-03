import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, CalendarRange, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import { NAVY, PLAN_STATUS, tint } from '@/lib/theme'

const KEY = 'ea.engagement'

interface EngagementCtx { engagement: string | null; enter: (id: string) => void; leave: () => void }
const Ctx = createContext<EngagementCtx>({ engagement: null, enter: () => {}, leave: () => {} })
export const useEngagement = () => useContext(Ctx)

function read(): string | null {
  try { return sessionStorage.getItem(KEY) } catch { return null }
}

/** Holds the selected engagement for the browser session; every new session starts on the welcome page. */
export function EngagementProvider({ children }: { children: ReactNode }) {
  const [engagement, set] = useState<string | null>(read)
  const enter = (id: string) => { try { sessionStorage.setItem(KEY, id) } catch { /* private mode */ } set(id) }
  const leave = () => { try { sessionStorage.removeItem(KEY) } catch { /* private mode */ } set(null) }
  return <Ctx.Provider value={{ engagement, enter, leave }}>{children}</Ctx.Provider>
}

function EngagementCard({ onOpen }: { onOpen: () => void }) {
  const q = useQuery({ queryKey: ['approach'], queryFn: api.approach })
  const a = q.data
  const cur = a?.phases.find((p) => p.id === a.current_phase)
  return (
    <button onClick={onOpen} className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-navy hover:shadow-md">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-lg" style={{ background: tint(NAVY, 0.08) }}><Building2 className="size-6 text-navy" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">Coromandel International Limited</span>
        <span className="block text-[12.5px] text-muted-foreground">Enterprise Architecture Assessment · TOGAF 9.1 · Murugappa Group</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          {q.isLoading ? <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Loading status</span> : a && (
            <>
              <span className="flex items-center gap-1"><CalendarRange className="size-3.5 text-navy" />Week {a.plan.current_week} of {a.plan.weeks}</span>
              {cur && <span>{cur.name}</span>}
              <span className="flex items-center gap-1.5"><span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${a.plan.progress}%`, background: PLAN_STATUS.done.color }} /></span>{a.plan.progress}% of tasks done</span>
            </>
          )}
        </span>
      </span>
      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ color: PLAN_STATUS.in_progress.color, background: tint(PLAN_STATUS.in_progress.color, 0.12) }}>In progress</span>
      <ChevronRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

/** First screen of every session: welcome, then pick an engagement to open. */
export function Welcome() {
  const { enter } = useEngagement()
  const [picking, setPicking] = useState(false)
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        <img src="/kpmg-logo.png" alt="KPMG" className="h-28 w-auto object-contain" />
        <h1 className="mt-8 text-[30px] leading-tight font-semibold text-navy">Welcome to the Enterprise Architecture Assessment Tool</h1>
        <p className="mt-3 text-[15px] text-muted-foreground">TOGAF-guided assessment of business, application, data and technology architecture, from current state to a prioritised roadmap.</p>
        <Button size="lg" className="mt-8 h-11 px-6 text-[15px]" onClick={() => setPicking(true)}>Let's Begin <ArrowRight /></Button>
      </div>
      <p className="absolute bottom-6 text-[11.5px] text-muted-foreground">KPMG Enterprise Architecture · Confidential</p>
      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[18px]">Available Engagements</DialogTitle>
            <DialogDescription>Select an engagement to open its assessment workspace.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-1">
            <div className="text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">Engagements (1)</div>
            <EngagementCard onOpen={() => enter('CIL')} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
